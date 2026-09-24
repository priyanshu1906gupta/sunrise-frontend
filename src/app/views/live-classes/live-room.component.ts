import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from '@coreui/angular';
import { apiErrorMessage } from '../../core/api.service';
import { AlertService } from '../../core/alert.service';
import { ConfirmService } from '../../core/confirm.service';
import { I18nService } from '../../core/i18n.service';
import { LiveAttendees, LiveChatMessage, LiveJoin, LiveService, WebrtcSignal } from '../../core/live.service';
import { requestLiveMedia } from '../../core/media-permissions';
import { TPipe } from '../../core/t.pipe';

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ]
};

@Component({
  selector: 'app-live-room',
  templateUrl: './live-room.component.html',
  styleUrl: './live-room.component.scss',
  imports: [ButtonDirective, TPipe]
})
export class LiveRoomComponent implements AfterViewInit, OnDestroy {
  private readonly live = inject(LiveService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('stage') stage?: ElementRef<HTMLElement>;
  @ViewChild('stageVideo') stageVideo?: ElementRef<HTMLVideoElement>;

  readonly session = signal<LiveJoin | null>(null);
  readonly messages = signal<LiveChatMessage[]>([]);
  readonly draft = signal('');
  readonly error = signal('');
  readonly ended = signal(false);
  readonly sending = signal(false);
  readonly status = signal('');
  readonly hasStream = signal(false);
  readonly fullScreen = signal(false);
  readonly insecure = signal(typeof window !== 'undefined' && !window.isSecureContext);
  readonly attendees = signal<LiveAttendees>({ count: 0, names: [] });
  readonly isHost = computed(() => this.session()?.role === 'moderator');

  private unsubs: Array<() => void> = [];
  private localStream: MediaStream | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();

  get sessionId(): string {
    return this.route.snapshot.paramMap.get('sessionId') || '';
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.teardown());
    if (typeof document !== 'undefined') {
      const onFs = () => this.fullScreen.set(Boolean(document.fullscreenElement));
      document.addEventListener('fullscreenchange', onFs);
      this.destroyRef.onDestroy(() => document.removeEventListener('fullscreenchange', onFs));
    }
  }

  ngAfterViewInit(): void {
    this.live.join(this.sessionId).subscribe({
      next: (row) => {
        this.session.set(row);
        void this.openRoom(row);
      },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  async send(): Promise<void> {
    const text = this.draft().trim();
    const session = this.session();
    if (!text || !session || this.isHost() || this.sending()) return;
    this.sending.set(true);
    const err = await this.live.sendChat(session.id, text);
    this.sending.set(false);
    if (err) {
      this.alerts.error(err);
      return;
    }
    this.draft.set('');
  }

  async confirmEnd(): Promise<void> {
    const session = this.session();
    if (!session || !this.isHost()) return;
    const ok = await this.confirm.ask(this.i18n.t('live.endConfirm'));
    if (!ok) return;
    this.live.end(session.id).subscribe({
      next: () => this.leaveEnded(),
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  back(): void {
    void this.exitFull();
    void this.router.navigate(this.catalogLink());
  }

  async toggleFull(): Promise<void> {
    if (this.fullScreen()) {
      await this.exitFull();
      return;
    }
    const el = this.stage?.nativeElement;
    const req = el?.requestFullscreen?.bind(el) || (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })?.webkitRequestFullscreen?.bind(el);
    try {
      if (req) await req();
    } catch {
      /* CSS overlay still covers the screen */
    }
    this.fullScreen.set(true);
  }

  private async exitFull(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
    this.fullScreen.set(false);
  }

  private catalogLink(): string[] {
    const branch = this.route.snapshot.paramMap.get('branchId');
    return branch ? ['/branches', branch, 'live-classes'] : ['/live-classes'];
  }

  private async openRoom(row: LiveJoin): Promise<void> {
    const err = await this.live.joinSession(row.id);
    if (err) {
      this.error.set(err);
      return;
    }
    this.unsubs.push(
      this.live.onChat((msg) => {
        if (msg.sessionId !== row.id) return;
        this.messages.update((list) => [...list, msg]);
      }),
      this.live.onChatHistory((msgs) => {
        this.messages.set(msgs.filter((m) => m.sessionId === row.id));
      }),
      this.live.onLiveEnded((ev) => {
        if (ev.sessionId !== row.id) return;
        this.leaveEnded();
      }),
      this.live.onSignal((ev) => void this.onSignal(ev.from, ev.data)),
      this.live.onViewer((ev) => {
        if (ev.sessionId !== row.id || !this.isHost()) return;
        void this.callViewer(ev.socketId);
      }),
      this.live.onViewerLeft((ev) => this.closePeer(ev.socketId)),
      this.live.onTeacherOnline((ev) => {
        if (ev.sessionId !== row.id || this.isHost()) return;
        void this.live.viewerReady(row.id);
      }),
      this.live.onTeacherOffline((ev) => {
        if (ev.sessionId !== row.id || this.isHost()) return;
        this.closeAllPeers();
        this.attachStream(null);
        this.status.set(this.i18n.t('live.waitingTeacher'));
      }),
      this.live.onAttendees((ev) => {
        this.attendees.set({ count: ev.count || 0, names: ev.names || [] });
      })
    );

    if (row.role === 'moderator') {
      await this.startTeacher(row.id);
    } else {
      this.status.set(this.i18n.t('live.waitingTeacher'));
      const ready = await this.live.viewerReady(row.id);
      if (ready.error) this.error.set(ready.error);
    }
  }

  private async startTeacher(sessionId: string): Promise<void> {
    this.status.set(this.i18n.t('live.startingCamera'));
    try {
      this.localStream = await requestLiveMedia();
    } catch {
      this.error.set(this.i18n.t('live.cameraError'));
      this.status.set('');
      return;
    }
    this.attachStream(this.localStream, true);
    const ready = await this.live.publisherReady(sessionId);
    if (ready.error) {
      this.error.set(ready.error);
      return;
    }
    this.status.set('');
    for (const viewerId of ready.viewers) void this.callViewer(viewerId);
  }

  private async callViewer(viewerId: string): Promise<void> {
    if (!this.localStream || this.peers.has(viewerId)) return;
    const pc = this.createPeer(viewerId);
    for (const track of this.localStream.getTracks()) pc.addTrack(track, this.localStream);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.live.sendSignal(viewerId, { type: 'offer', sdp: pc.localDescription || offer });
  }

  private createPeer(remoteId: string): RTCPeerConnection {
    this.closePeer(remoteId);
    const pc = new RTCPeerConnection(ICE);
    this.peers.set(remoteId, pc);
    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.live.sendSignal(remoteId, { type: 'ice', candidate: ev.candidate.toJSON() });
    };
    pc.ontrack = (ev) => {
      const stream = ev.streams[0] || new MediaStream([ev.track]);
      this.attachStream(stream, false);
    };
    return pc;
  }

  private async onSignal(from: string, data: WebrtcSignal): Promise<void> {
    if (data.type === 'offer' && data.sdp) {
      const pc = this.createPeer(from);
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      await this.flushIce(from, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.live.sendSignal(from, { type: 'answer', sdp: pc.localDescription || answer });
      return;
    }
    let pc = this.peers.get(from);
    if (data.type === 'answer' && data.sdp) {
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      await this.flushIce(from, pc);
      return;
    }
    if (data.type === 'ice' && data.candidate) {
      if (!pc || !pc.remoteDescription) {
        const queued = this.pendingIce.get(from) ?? [];
        queued.push(data.candidate);
        this.pendingIce.set(from, queued);
        return;
      }
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }

  private async flushIce(remoteId: string, pc: RTCPeerConnection): Promise<void> {
    const queued = this.pendingIce.get(remoteId) ?? [];
    this.pendingIce.delete(remoteId);
    for (const candidate of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private attachStream(stream: MediaStream | null, muted = false): void {
    const el = this.stageVideo?.nativeElement;
    this.hasStream.set(Boolean(stream));
    if (!el) return;
    el.srcObject = stream;
    el.muted = muted;
    if (stream) void el.play().catch(() => undefined);
  }

  private closePeer(id: string): void {
    const pc = this.peers.get(id);
    if (!pc) return;
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.close();
    this.peers.delete(id);
    this.pendingIce.delete(id);
  }

  private closeAllPeers(): void {
    for (const id of [...this.peers.keys()]) this.closePeer(id);
  }

  private leaveEnded(): void {
    if (this.ended()) return;
    this.ended.set(true);
    this.messages.set([]);
    this.attendees.set({ count: 0, names: [] });
    this.live.leaveSession();
    this.stopMedia();
    void this.exitFull();
    this.alerts.info(this.i18n.t('live.ended'));
    void this.router.navigate(this.catalogLink());
  }

  private stopMedia(): void {
    this.closeAllPeers();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.attachStream(null);
  }

  private teardown(): void {
    this.live.leaveSession();
    for (const off of this.unsubs) off();
    this.unsubs = [];
    void this.exitFull();
    this.stopMedia();
  }
}
