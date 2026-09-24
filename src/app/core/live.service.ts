import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export type LiveSubject = {
  id: string;
  name: string;
  liveSessionId: string | null;
};

export type LiveCourse = {
  id: string;
  name: string;
  branchId: string;
  subjects: LiveSubject[];
};

export type LiveCatalog = { courses: LiveCourse[] };

export type LiveJoin = {
  id: string;
  branchId: string;
  courseId: string;
  subjectId: string;
  courseName: string;
  subjectName: string;
  status: 'LIVE' | 'ENDED';
  jitsiRoom: string;
  jitsiDomain: string;
  role: 'moderator' | 'viewer';
  startedById: string;
  hostName: string;
  displayName: string;
  startedAt: string;
};

export type LiveChatMessage = {
  id: string;
  sessionId: string;
  senderId: string;
  studentName: string;
  text: string;
  sentAt: string;
};

export type WebrtcSignal = {
  type: 'offer' | 'answer' | 'ice';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

export type LiveStartedEvent = {
  sessionId: string;
  courseId: string;
  subjectId: string;
  courseName: string;
  subjectName: string;
};

export type LiveAttendees = {
  count: number;
  names: string[];
};

function socketOrigin(apiBase: string): string {
  try {
    const url = new URL(apiBase, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return url.origin;
  } catch {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
}

@Injectable({ providedIn: 'root' })
export class LiveService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;
  private boundToken: string | null = null;
  private pendingBranchId: string | null = null;
  private pendingSessionId: string | null = null;

  catalog(branchId?: string): Observable<LiveCatalog> {
    return this.api.get<LiveCatalog>('/live/catalog', { branchId });
  }

  start(body: { branchId?: string; courseId: string; subjectId: string }): Observable<LiveJoin> {
    return this.api.post<LiveJoin>('/live/start', body);
  }

  join(id: string): Observable<LiveJoin> {
    return this.api.get<LiveJoin>(`/live/${id}`);
  }

  end(id: string): Observable<{ ended: boolean; id: string }> {
    return this.api.post(`/live/${id}/end`, {});
  }

  connect(): Socket {
    const token = this.auth.token();
    if (this.socket && this.boundToken === token) return this.socket;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.boundToken = token;
    this.socket = io(socketOrigin(this.api.base), {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      auth: { token },
      autoConnect: true
    });
    this.socket.on('connect', () => {
      if (this.pendingBranchId) this.socket?.emit('join:branch', this.pendingBranchId);
      if (this.pendingSessionId) this.socket?.emit('join:session', this.pendingSessionId);
    });
    return this.socket;
  }

  joinBranch(branchId: string): void {
    this.pendingBranchId = branchId;
    const socket = this.connect();
    if (socket.connected) socket.emit('join:branch', branchId);
  }

  leaveBranch(branchId: string): void {
    if (this.pendingBranchId === branchId) this.pendingBranchId = null;
    this.socket?.emit('leave:branch', branchId);
  }

  joinSession(sessionId: string): Promise<string | undefined> {
    this.pendingSessionId = sessionId;
    return new Promise((resolve) => {
      const socket = this.connect();
      const send = () => socket.emit('join:session', sessionId, (err?: string) => resolve(err));
      if (socket.connected) send();
      else socket.once('connect', send);
    });
  }

  sendChat(sessionId: string, text: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      const socket = this.connect();
      const send = () => socket.emit('chat:send', { sessionId, text }, (err?: string) => resolve(err));
      if (socket.connected) send();
      else socket.once('connect', send);
    });
  }

  onChat(handler: (msg: LiveChatMessage) => void): () => void {
    const socket = this.connect();
    socket.on('chat:message', handler);
    return () => socket.off('chat:message', handler);
  }

  onChatHistory(handler: (msgs: LiveChatMessage[]) => void): () => void {
    const socket = this.connect();
    socket.on('chat:history', handler);
    return () => socket.off('chat:history', handler);
  }

  onLiveStarted(handler: (ev: LiveStartedEvent) => void): () => void {
    const socket = this.connect();
    socket.on('live:started', handler);
    return () => socket.off('live:started', handler);
  }

  onLiveEnded(handler: (ev: { sessionId: string }) => void): () => void {
    const socket = this.connect();
    socket.on('live:ended', handler);
    return () => socket.off('live:ended', handler);
  }

  onAttendees(handler: (ev: LiveAttendees) => void): () => void {
    const socket = this.connect();
    socket.on('live:attendees', handler);
    return () => socket.off('live:attendees', handler);
  }

  socketId(): string | undefined {
    return this.connect().id;
  }

  publisherReady(sessionId: string): Promise<{ error?: string; viewers: string[] }> {
    return new Promise((resolve) => {
      const socket = this.connect();
      const send = () =>
        socket.emit('webrtc:publisher-ready', sessionId, (err?: string, viewers?: string[]) =>
          resolve({ error: err, viewers: viewers || [] })
        );
      if (socket.connected) send();
      else socket.once('connect', send);
    });
  }

  viewerReady(sessionId: string): Promise<{ error?: string; teacherId?: string | null }> {
    return new Promise((resolve) => {
      const socket = this.connect();
      const send = () =>
        socket.emit('webrtc:viewer-ready', sessionId, (err?: string, teacherId?: string | null) =>
          resolve({ error: err, teacherId })
        );
      if (socket.connected) send();
      else socket.once('connect', send);
    });
  }

  sendSignal(to: string, data: unknown): void {
    this.connect().emit('webrtc:signal', { to, data });
  }

  onViewer(handler: (ev: { socketId: string; sessionId: string }) => void): () => void {
    const socket = this.connect();
    socket.on('webrtc:viewer', handler);
    return () => socket.off('webrtc:viewer', handler);
  }

  onViewerLeft(handler: (ev: { socketId: string; sessionId: string }) => void): () => void {
    const socket = this.connect();
    socket.on('webrtc:viewer-left', handler);
    return () => socket.off('webrtc:viewer-left', handler);
  }

  onTeacherOnline(handler: (ev: { sessionId: string }) => void): () => void {
    const socket = this.connect();
    socket.on('webrtc:teacher-online', handler);
    return () => socket.off('webrtc:teacher-online', handler);
  }

  onTeacherOffline(handler: (ev: { sessionId: string }) => void): () => void {
    const socket = this.connect();
    socket.on('webrtc:teacher-offline', handler);
    return () => socket.off('webrtc:teacher-offline', handler);
  }

  onSignal(handler: (ev: { from: string; data: WebrtcSignal }) => void): () => void {
    const socket = this.connect();
    const wrapped = (ev: { from: string; data: WebrtcSignal }) => handler(ev);
    socket.on('webrtc:signal', wrapped);
    return () => socket.off('webrtc:signal', wrapped);
  }

  leaveSession(): void {
    this.pendingSessionId = null;
  }

  disconnect(): void {
    this.pendingBranchId = null;
    this.pendingSessionId = null;
    this.boundToken = null;
    this.socket?.disconnect();
    this.socket = null;
  }
}
