import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  FormControlDirective,
  FormDirective,
  FormLabelDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  RowComponent
} from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { AlertService } from '../../core/alert.service';
import { toYmd } from '../../core/date';
import { I18nService } from '../../core/i18n.service';
import { InrPipe } from '../../core/inr.pipe';
import { onBranchRouteChange } from '../../core/on-branch-route';
import { TPipe } from '../../core/t.pipe';
import { IconDirective } from '@coreui/icons-angular';
import { ModalCloseComponent } from '../../shared/modal-close.component';
import { EmptyComponent } from '../../shared/empty.component';

type CourseOpt = { id: string; name: string; durationMonths: number; price: number };
type BatchRow = {
  id: string;
  name: string;
  time?: string | null;
  durationMonths: number;
  price: number;
  startDate: string;
  endDate: string;
  courseId: string;
  courseName: string;
};

@Component({
  selector: 'app-batches',
  templateUrl: './batches.component.html',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    ButtonDirective,
    CardComponent,
    CardBodyComponent,
    ColComponent,
    RowComponent,
    FormDirective,
    FormControlDirective,
    FormLabelDirective,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    InrPipe,
    TPipe,
    EmptyComponent,
    IconDirective,
    ModalCloseComponent
  ]
})
export class BatchesComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);

  readonly batches = signal<BatchRow[]>([]);
  readonly courses = signal<CourseOpt[]>([]);
  readonly error = signal('');
  readonly open = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    courseId: ['', Validators.required],
    time: [''],
    startDate: [toYmd(new Date()), Validators.required]
  });

  get branchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || this.auth.branches()[0]?.id;
  }

  get selectedDuration(): number | null {
    const id = this.form.controls.courseId.value;
    return this.courses().find((c) => c.id === id)?.durationMonths ?? null;
  }

  constructor() {
    onBranchRouteChange(() => this.load());
  }

  load(): void {
    this.api.get<BatchRow[]>('/batches', { branchId: this.branchId }).subscribe({
      next: (rows) => this.batches.set(rows || []),
      error: (e) => this.error.set(apiErrorMessage(e))
    });
    this.api.get<CourseOpt[]>('/courses', { branchId: this.branchId }).subscribe({
      next: (rows) => this.courses.set(rows || []),
      error: () => this.courses.set([])
    });
  }

  openAdd(item?: BatchRow): void {
    this.editingId.set(item?.id ?? null);
    this.form.reset({
      name: item?.name || '',
      courseId: item?.courseId || '',
      time: item?.time || '',
      startDate: item ? toYmd(item.startDate) : toYmd(new Date())
    });
    this.open.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      name: v.name,
      courseId: v.courseId,
      time: v.time || null,
      startDate: toYmd(v.startDate),
      branchId: this.branchId
    };
    const req = this.editingId() ? this.api.put(`/batches/${this.editingId()}`, body) : this.api.post('/batches', body);
    req.subscribe({
      next: () => {
        this.open.set(false);
        this.alerts.success(this.i18n.t('common.saved'));
        this.load();
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  async remove(id: string): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('common.deleteConfirm')))) return;
    this.api.delete(`/batches/${id}`).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('common.deleted'));
        this.load();
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }
}
