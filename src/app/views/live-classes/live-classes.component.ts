import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective, CardBodyComponent, CardComponent, ColComponent, RowComponent } from '@coreui/angular';
import { apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AlertService } from '../../core/alert.service';
import { LiveCatalog, LiveCourse, LiveService } from '../../core/live.service';
import { onBranchRouteChange } from '../../core/on-branch-route';
import { TPipe } from '../../core/t.pipe';
import { EmptyComponent } from '../../shared/empty.component';

@Component({
  selector: 'app-live-classes',
  templateUrl: './live-classes.component.html',
  styleUrl: './live-classes.component.scss',
  imports: [ButtonDirective, CardComponent, CardBodyComponent, ColComponent, RowComponent, TPipe, EmptyComponent]
})
export class LiveClassesComponent {
  readonly auth = inject(AuthService);
  private readonly live = inject(LiveService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly courses = signal<LiveCourse[]>([]);
  readonly courseId = signal('');
  readonly error = signal('');
  readonly starting = signal(false);

  readonly selected = computed(() => this.courses().find((c) => c.id === this.courseId()) ?? null);
  readonly isStaff = computed(() => this.auth.canAuthorTests());

  get branchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || this.auth.branches()[0]?.id;
  }

  constructor() {
    onBranchRouteChange(() => this.load());
    const poll = setInterval(() => this.load(true), 8000);
    const offStart = this.live.onLiveStarted(() => this.load(true));
    const offEnd = this.live.onLiveEnded(() => this.load(true));
    this.destroyRef.onDestroy(() => {
      clearInterval(poll);
      offStart();
      offEnd();
      if (this.branchId) this.live.leaveBranch(this.branchId);
    });
  }

  load(quiet = false): void {
    if (this.branchId) this.live.joinBranch(this.branchId);
    this.live.catalog(this.branchId).subscribe({
      next: (res: LiveCatalog) => {
        this.courses.set(res.courses || []);
        if (!this.courseId() && res.courses?.length) this.courseId.set(res.courses[0].id);
        if (!res.courses.some((c) => c.id === this.courseId()) && res.courses[0]) {
          this.courseId.set(res.courses[0].id);
        }
        this.error.set('');
      },
      error: (e) => {
        if (!quiet) this.error.set(apiErrorMessage(e));
      }
    });
  }

  selectCourse(id: string): void {
    this.courseId.set(id);
  }

  roomLink(sessionId: string): string[] {
    const branch = this.route.snapshot.paramMap.get('branchId');
    return branch ? ['/branches', branch, 'live-classes', sessionId] : ['/live-classes', sessionId];
  }

  async goLive(subjectId: string): Promise<void> {
    const course = this.selected();
    if (!course || this.starting()) return;
    this.starting.set(true);
    this.live
      .start({
        branchId: this.branchId,
        courseId: course.id,
        subjectId
      })
      .subscribe({
        next: (session) => {
          this.starting.set(false);
          void this.router.navigate(this.roomLink(session.id));
        },
        error: (e) => {
          this.starting.set(false);
          this.alerts.error(apiErrorMessage(e));
        }
      });
  }

  join(sessionId: string | null): void {
    if (!sessionId) return;
    void this.router.navigate(this.roomLink(sessionId));
  }
}
