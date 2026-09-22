import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective, CardComponent, TableDirective } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AlertService } from '../../core/alert.service';
import { ConfirmService } from '../../core/confirm.service';
import { I18nService } from '../../core/i18n.service';
import { onBranchRouteChange } from '../../core/on-branch-route';
import { TPipe } from '../../core/t.pipe';
import { EmptyComponent } from '../../shared/empty.component';

export type StudyRow = {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  subjectId: string;
  subjectName: string;
  branchId: string;
  createdAt: string;
};

@Component({
  selector: 'app-study-list',
  templateUrl: './study-list.component.html',
  imports: [ButtonDirective, CardComponent, TableDirective, IconDirective, RouterLink, TPipe, EmptyComponent]
})
export class StudyListComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly alerts = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nService);

  readonly rows = signal<StudyRow[]>([]);
  readonly courseFilter = signal('');
  readonly subjectFilter = signal('');
  readonly error = signal('');

  readonly courses = computed(() => {
    const map = new Map<string, string>();
    for (const r of this.rows()) map.set(r.courseId, r.courseName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  });

  readonly subjects = computed(() => {
    const courseId = this.courseFilter();
    const map = new Map<string, string>();
    for (const r of this.rows()) {
      if (courseId && r.courseId !== courseId) continue;
      map.set(r.subjectId, r.subjectName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  });

  readonly filtered = computed(() => {
    const courseId = this.courseFilter();
    const subjectId = this.subjectFilter();
    return this.rows().filter((r) => {
      if (courseId && r.courseId !== courseId) return false;
      if (subjectId && r.subjectId !== subjectId) return false;
      return true;
    });
  });

  get branchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || this.auth.branches()[0]?.id;
  }

  get newLink(): string[] {
    const id = this.route.snapshot.paramMap.get('branchId');
    return id ? ['/branches', id, 'study-materials', 'new'] : ['/study-materials', 'new'];
  }

  viewLink(id: string): string[] {
    const branchId = this.route.snapshot.paramMap.get('branchId');
    return branchId ? ['/branches', branchId, 'study-materials', id, 'view'] : ['/study-materials', id, 'view'];
  }

  constructor() {
    onBranchRouteChange(() => this.load());
  }

  onCourseChange(value: string): void {
    this.courseFilter.set(value);
    this.subjectFilter.set('');
  }

  load(): void {
    this.api.get<StudyRow[]>('/study-materials', { branchId: this.branchId }).subscribe({
      next: (rows) => {
        this.rows.set(rows || []);
        this.error.set('');
      },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  async remove(id: string): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('common.deleteConfirm')))) return;
    this.api.delete(`/study-materials/${id}`).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('common.deleted'));
        this.load();
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }
}
