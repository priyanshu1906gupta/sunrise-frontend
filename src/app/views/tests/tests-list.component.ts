import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective, CardBodyComponent, CardComponent, ColComponent, RowComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AlertService } from '../../core/alert.service';
import { ConfirmService } from '../../core/confirm.service';
import { I18nService } from '../../core/i18n.service';
import { onBranchRouteChange } from '../../core/on-branch-route';
import { TPipe } from '../../core/t.pipe';
import { EmptyComponent } from '../../shared/empty.component';
import { StaffTestRow } from './test.models';

@Component({
  selector: 'app-tests-list',
  templateUrl: './tests-list.component.html',
  imports: [ButtonDirective, CardComponent, CardBodyComponent, ColComponent, RowComponent, IconDirective, RouterLink, TPipe, EmptyComponent]
})
export class TestsListComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly alerts = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nService);

  readonly tests = signal<StaffTestRow[]>([]);
  readonly courseFilter = signal('');
  readonly error = signal('');

  readonly courses = computed(() => {
    const map = new Map<string, string>();
    for (const t of this.tests()) map.set(t.courseId, t.courseName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  });

  readonly grouped = computed(() => {
    const filter = this.courseFilter();
    const rows = filter ? this.tests().filter((t) => t.courseId === filter) : this.tests();
    const groups: Array<{ courseId: string; courseName: string; tests: StaffTestRow[] }> = [];
    const index = new Map<string, number>();
    for (const t of rows) {
      let i = index.get(t.courseId);
      if (i == null) {
        i = groups.length;
        index.set(t.courseId, i);
        groups.push({ courseId: t.courseId, courseName: t.courseName, tests: [] });
      }
      groups[i].tests.push(t);
    }
    return groups;
  });

  get branchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || this.auth.branches()[0]?.id;
  }

  get newLink(): string[] {
    const id = this.route.snapshot.paramMap.get('branchId');
    return id ? ['/branches', id, 'add-tests', 'new'] : ['/add-tests', 'new'];
  }

  viewLink(testId: string): string[] {
    const id = this.route.snapshot.paramMap.get('branchId');
    return id ? ['/branches', id, 'add-tests', testId] : ['/add-tests', testId];
  }

  constructor() {
    onBranchRouteChange(() => this.load());
  }

  load(): void {
    this.api.get<StaffTestRow[]>('/tests', { branchId: this.branchId }).subscribe({
      next: (rows) => {
        this.tests.set(rows || []);
        this.error.set('');
      },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  async remove(id: string): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('common.deleteConfirm')))) return;
    this.api.delete(`/tests/${id}`).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('common.deleted'));
        this.load();
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }
}
