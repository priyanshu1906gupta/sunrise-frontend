import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ButtonDirective, CardComponent, FormControlDirective, FormDirective, FormLabelDirective,
  ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TableDirective
} from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { AlertService } from '../../core/alert.service';
import { toYmd } from '../../core/date';
import { I18nService } from '../../core/i18n.service';
import { InrPipe } from '../../core/inr.pipe';
import { Paginated } from '../../core/models';
import { onBranchRouteChange } from '../../core/on-branch-route';
import { TPipe } from '../../core/t.pipe';
import { IconDirective } from '@coreui/icons-angular';
import { ModalCloseComponent } from '../../shared/modal-close.component';
import { EmptyComponent } from '../../shared/empty.component';
import { PagerComponent } from '../../shared/pager.component';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.component.html',
  imports: [
    DatePipe, ReactiveFormsModule, ButtonDirective, CardComponent, FormDirective, FormControlDirective,
    FormLabelDirective, ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    TableDirective, InrPipe, TPipe, EmptyComponent, PagerComponent, IconDirective, ModalCloseComponent
  ]
})
export class ExpensesComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);

  readonly list = signal<Paginated<any> | null>(null);
  readonly error = signal('');
  readonly open = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly year = signal(new Date().getFullYear());
  readonly month = signal(new Date().getMonth() + 1);
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    dueDate: [toYmd(new Date()), Validators.required],
    amount: [0, Validators.required],
    comment: ['']
  });

  readonly monthOptions = computed(() => {
    this.i18n.lang();
    const locale = this.i18n.lang() === 'hi' ? 'hi-IN' : 'en-IN';
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: new Date(2026, i, 1).toLocaleString(locale, { month: 'short' })
    }));
  });

  get branchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || this.auth.branches()[0]?.id;
  }

  constructor() {
    onBranchRouteChange(() => this.load());
  }

  load(page = 1): void {
    this.api.get<Paginated<any>>('/expenses', {
      page,
      pageSize: 20,
      branchId: this.branchId,
      month: this.month(),
      year: this.year()
    }).subscribe({ next: (d) => this.list.set(d), error: (e) => this.error.set(apiErrorMessage(e)) });
  }

  openAdd(item?: any): void {
    this.editingId.set(item ? (item['id'] as string) : null);
    this.form.reset({
      name: (item?.['name'] as string) || '',
      dueDate: item ? toYmd(item['dueDate']) : this.defaultDue(),
      amount: Number(item?.['amount'] || 0),
      comment: (item?.['comment'] as string) || ''
    });
    this.open.set(true);
  }

  save(): void {
    const v = this.form.getRawValue();
    const body = { name: v.name, dueDate: toYmd(v.dueDate), amount: Number(v.amount), comment: v.comment || null, branchId: this.branchId };
    const req = this.editingId() ? this.api.put(`/expenses/${this.editingId()}`, body) : this.api.post('/expenses', body);
    req.subscribe({
      next: () => {
        this.open.set(false);
        this.alerts.success(this.i18n.t('common.saved'));
        this.load();
      },
      error: (e) => {
        this.error.set(apiErrorMessage(e));
        this.alerts.error(apiErrorMessage(e));
      }
    });
  }

  async remove(id: string): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('common.deleteConfirm')))) return;
    this.api.delete(`/expenses/${id}`).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('common.deleted'));
        this.load();
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  private defaultDue(): string {
    const y = this.year();
    const m = this.month();
    const now = new Date();
    if (y === now.getFullYear() && m === now.getMonth() + 1) return toYmd(now);
    return toYmd(new Date(y, m - 1, 1));
  }
}
