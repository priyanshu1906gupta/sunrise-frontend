import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BadgeComponent,
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
  RowComponent,
  TableDirective
} from '@coreui/angular';
import { ApiService, apiErrorMessage, triggerBrowserDownload } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { AlertService } from '../../core/alert.service';
import { I18nService } from '../../core/i18n.service';
import { toYmd, addMonthsYmd } from '../../core/date';
import { InrPipe } from '../../core/inr.pipe';
import { Paginated } from '../../core/models';
import { onBranchRouteChange } from '../../core/on-branch-route';
import { TPipe } from '../../core/t.pipe';
import { IconDirective } from '@coreui/icons-angular';
import { ModalCloseComponent } from '../../shared/modal-close.component';
import { EmptyComponent } from '../../shared/empty.component';
import { PagerComponent } from '../../shared/pager.component';
import { PhotoUploadComponent } from '../../shared/photo-upload.component';
import { FallbackSrcDirective } from '../../shared/fallback-src.directive';
import { PhotoFormSession, PhotoPickerService } from '../../core/photo-picker.service';

type MemberPaymentRow = {
  id: string;
  amount: number;
  paymentDate: string | Date;
  dueAmountAfter: number;
  paymentMode?: 'CASH' | 'ONLINE';
};

type Named = { id: string; name: string };
type CourseOpt = Named & { durationMonths: number; price: number };
type BatchOpt = Named & { courseId: string };

function paidNotOverPackage(group: AbstractControl): ValidationErrors | null {
  if (group.get('paidAmount')?.disabled) return null;
  const amount = Number(group.get('monthlyAmount')?.value);
  const paid = Number(group.get('paidAmount')?.value);
  if (!Number.isFinite(amount) || !Number.isFinite(paid)) return null;
  if (paid > amount) return { paidExceedsAmount: true };
  return null;
}

@Component({
  selector: 'app-members',
  templateUrl: './members.component.html',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    BadgeComponent,
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
    TableDirective,
    InrPipe,
    TPipe,
    EmptyComponent,
    PagerComponent,
    PhotoUploadComponent,
    FallbackSrcDirective,
    IconDirective,
    ModalCloseComponent
  ]
})
export class MembersComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);
  readonly photos = inject(PhotoPickerService);

  readonly list = signal<Paginated<any> | null>(null);
  readonly page = signal(1);
  readonly search = signal('');
  readonly filterBranch = signal('');
  readonly filterCourse = signal('');
  readonly listStatus = signal<'active' | 'deactive'>('active');
  readonly courses = signal<CourseOpt[]>([]);
  readonly batches = signal<BatchOpt[]>([]);
  readonly classes = signal<Named[]>([]);
  readonly boards = signal<Named[]>([]);
  readonly selectedCourseIds = signal<string[]>([]);
  readonly selectedBatchIds = signal<string[]>([]);
  readonly durationOptions = signal<number[]>([1, 2, 3, 6, 12]);
  readonly error = signal('');
  readonly formOpen = signal(false);
  readonly detail = signal<any>(null);
  readonly detailTab = signal<'general' | 'transactions'>('general');
  readonly txnPage = signal(1);
  readonly txnPageSize = 20;
  readonly photoId = signal<string | null>(null);
  readonly photoUrl = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      fullName: ['', Validators.required],
      gender: ['MALE', Validators.required],
      monthlyAmount: [0 as number, [Validators.required, Validators.min(0)]],
      registrationCharge: [0 as number, [Validators.required, Validators.min(0)]],
      paidAmount: [0 as number, [Validators.required, Validators.min(0)]],
      subscriptionMonths: ['1', Validators.required],
      schoolClassId: [''],
      boardId: [''],
      dateOfBirth: [''],
      paymentDate: [toYmd(new Date()), Validators.required],
      joiningDate: [toYmd(new Date()), Validators.required],
      email: [''],
      phone: [''],
      emergencyContact: [''],
      status: ['ACTIVE'],
      branchId: ['']
    },
    { validators: paidNotOverPackage }
  );

  get routeBranchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || undefined;
  }

  get isDeactiveList(): boolean {
    return this.listStatus() === 'deactive';
  }

  get derivedPaymentStatus(): 'PAID' | 'UNPAID' {
    const amount = Number(this.form.controls.monthlyAmount.value);
    const paid = Number(this.form.controls.paidAmount.value);
    return Number.isFinite(amount) && Number.isFinite(paid) && amount > 0 && paid >= amount ? 'PAID' : 'UNPAID';
  }

  get formNextPaymentDate(): string {
    const months = Number(this.form.controls.subscriptionMonths.value) || 1;
    return addMonthsYmd(this.form.controls.paymentDate.value, months);
  }

  remainingAmount(d: Record<string, unknown>): number {
    const due = Number(d['dueAmount']);
    if (Number.isFinite(due) && due >= 0) return due;
    const amount = Number(d['paymentAmount'] ?? d['monthlyAmount']);
    const paid = Number(d['paidAmount']);
    if (!Number.isFinite(amount) || !Number.isFinite(paid)) return 0;
    return Math.max(0, amount - paid);
  }

  courseNames(m: Record<string, unknown>): string {
    const rows = m['courses'];
    if (!Array.isArray(rows) || !rows.length) return '—';
    return rows.map((c: { name?: string }) => c.name || '').filter(Boolean).join(', ') || '—';
  }

  paymentModeLabel(mode: unknown): string {
    return mode === 'ONLINE' ? 'payments.online' : 'payments.cash';
  }

  paymentsOf(d: Record<string, unknown> | null | undefined): MemberPaymentRow[] {
    const rows = d?.['payments'];
    return Array.isArray(rows) ? (rows as MemberPaymentRow[]) : [];
  }

  pagedPayments(d: Record<string, unknown>): MemberPaymentRow[] {
    const start = (this.txnPage() - 1) * this.txnPageSize;
    return this.paymentsOf(d).slice(start, start + this.txnPageSize);
  }

  txnTotalPages(d: Record<string, unknown>): number {
    return Math.ceil(this.paymentsOf(d).length / this.txnPageSize) || 0;
  }

  onDetailVisible(open: boolean): void {
    if (open) return;
    this.detail.set(null);
    this.detailTab.set('general');
    this.txnPage.set(1);
  }

  constructor() {
    onBranchRouteChange(() => {
      this.search.set('');
      this.filterBranch.set('');
      this.filterCourse.set('');
      this.listStatus.set('active');
      this.loadCatalog();
      this.load(1);
    });
    this.form.controls.branchId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.formOpen()) this.loadCatalog(true);
    });
    this.form.controls.registrationCharge.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.recalcPayment());
    const restore = this.photos.takeRestore('members');
    if (restore) queueMicrotask(() => this.restoreSession(restore));
  }

  private restoreSession(session: PhotoFormSession): void {
    if (session.editingId) {
      this.openEdit(session.editingId, session.form);
      return;
    }
    this.openAdd();
    if (session.form) this.form.patchValue(session.form as never);
  }

  stashPhotoForm(): void {
    this.photos.stash(this.form.getRawValue());
  }

  runSearch(): void {
    this.load(1);
  }

  private scopedBranch(fromForm = false): string | undefined {
    return (
      this.routeBranchId ||
      (fromForm ? this.form.controls.branchId.value : this.filterBranch()) ||
      this.auth.branches()[0]?.id
    );
  }

  loadCatalog(fromForm = false): void {
    const branchId = this.scopedBranch(fromForm);
    this.api.get<CourseOpt[]>('/courses', { branchId }).subscribe({
      next: (rows) => this.courses.set(rows || []),
      error: () => this.courses.set([])
    });
    this.api.get<BatchOpt[]>('/batches', { branchId }).subscribe({
      next: (rows) => this.batches.set(rows || []),
      error: () => this.batches.set([])
    });
    this.api.get<{ classes: Named[]; boards: Named[] }>('/catalogs').subscribe({
      next: (d) => {
        this.classes.set(d.classes || []);
        this.boards.set(d.boards || []);
      },
      error: () => {
        this.classes.set([]);
        this.boards.set([]);
      }
    });
  }

  load(page = 1): void {
    this.page.set(page);
    this.api
      .get<Paginated<any>>('/students', {
        page,
        pageSize: 20,
        search: this.search().trim(),
        branchId: this.routeBranchId || this.filterBranch() || undefined,
        courseId: this.filterCourse() || undefined,
        listStatus: this.listStatus()
      })
      .subscribe({
        next: (d) => this.list.set(d),
        error: (e) => this.error.set(apiErrorMessage(e))
      });
  }

  onFormVisible(visible: boolean): void {
    this.photos.onModalVisible(visible, (v) => this.formOpen.set(v));
  }

  toggleCourse(id: string): void {
    const cur = this.selectedCourseIds();
    this.selectedCourseIds.set(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
    this.recalcPayment();
  }

  toggleBatch(id: string): void {
    const cur = this.selectedBatchIds();
    this.selectedBatchIds.set(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  private recalcPayment(): void {
    const selected = this.courses().filter((c) => this.selectedCourseIds().includes(c.id));
    const courseCharge = selected.reduce((sum, c) => sum + Number(c.price || 0), 0);
    const registration = Number(this.form.controls.registrationCharge.value) || 0;
    this.form.controls.monthlyAmount.setValue(courseCharge + registration, { emitEvent: false });
    const durations = [...new Set(selected.map((c) => c.durationMonths))].sort((a, b) => a - b);
    this.durationOptions.set(durations.length ? durations : [1, 2, 3, 6, 12]);
    if (durations.length && !durations.includes(Number(this.form.controls.subscriptionMonths.value))) {
      this.form.controls.subscriptionMonths.setValue(String(durations[0]));
    }
  }

  openAdd(): void {
    this.editingId.set(null);
    const draft = this.photos.peekDraft('member-photo');
    this.photoId.set(draft?.id ?? null);
    this.photoUrl.set(draft?.url ?? null);
    this.error.set('');
    this.selectedCourseIds.set([]);
    this.selectedBatchIds.set([]);
    this.form.reset({
      fullName: '',
      gender: 'MALE',
      monthlyAmount: 0,
      registrationCharge: 0,
      paidAmount: 0,
      subscriptionMonths: '1',
      schoolClassId: '',
      boardId: '',
      dateOfBirth: '',
      paymentDate: toYmd(new Date()),
      joiningDate: toYmd(new Date()),
      email: '',
      phone: '',
      emergencyContact: '',
      status: 'ACTIVE',
      branchId: this.routeBranchId || this.auth.branches()[0]?.id || ''
    });
    this.form.controls.paidAmount.enable();
    this.formOpen.set(true);
    this.loadCatalog(true);
    this.photos.noteHost('members', null);
  }

  openDetail(id: string): void {
    this.detailTab.set('general');
    this.txnPage.set(1);
    this.api.get<any>(`/students/${id}`).subscribe({
      next: (d) => this.detail.set(d),
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  openEdit(id: string, restoreForm?: Record<string, unknown>): void {
    this.api.get<any>(`/students/${id}`).subscribe({
      next: (d) => {
        if (d['deactivated']) {
          this.detail.set(d);
          return;
        }
        this.detail.set(d);
        this.editFromDetail();
        if (restoreForm) this.form.patchValue(restoreForm as never);
      },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  editFromDetail(): void {
    const d = this.detail();
    if (!d || d['deactivated']) return;
    this.editingId.set(d['id'] as string);
    this.photoId.set(this.photos.peekDraft('member-photo')?.id || (d['photoFileId'] as string) || null);
    this.photoUrl.set(this.photos.peekDraft('member-photo')?.url || (d['photoUrl'] as string) || null);
    this.error.set('');
    const courseIds = Array.isArray(d['courses']) ? d['courses'].map((c: { id: string }) => c.id) : [];
    const batchIds = Array.isArray(d['batches']) ? d['batches'].map((b: { id: string }) => b.id) : [];
    this.selectedCourseIds.set(courseIds);
    this.selectedBatchIds.set(batchIds);
    this.form.patchValue({
      fullName: d['fullName'] as string,
      gender: d['gender'] as string,
      monthlyAmount: Number(d['paymentAmount'] ?? d['monthlyAmount'] ?? 0),
      registrationCharge: Number(d['registrationCharge'] ?? 0),
      paidAmount: Number(d['paidAmount'] ?? 0),
      subscriptionMonths: String(d['subscriptionMonths'] ?? 1),
      schoolClassId: (d['schoolClassId'] as string) || '',
      boardId: (d['boardId'] as string) || '',
      dateOfBirth: d['dateOfBirth'] ? toYmd(d['dateOfBirth']) : '',
      paymentDate: toYmd(d['paymentDate']),
      joiningDate: toYmd(d['joiningDate']),
      email: (d['email'] as string) || '',
      phone: (d['phone'] as string) || '',
      emergencyContact: (d['emergencyContact'] as string) || '',
      status: d['status'] as string,
      branchId: d['branchId'] as string
    });
    this.form.controls.paidAmount.disable({ emitEvent: false });
    this.detail.set(null);
    this.formOpen.set(true);
    this.loadCatalog(true);
    this.recalcPayment();
    this.photos.noteHost('members', d['id'] as string);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.hasError('paidExceedsAmount')) {
        this.alerts.error(this.i18n.t('members.paidExceeds'));
      }
      return;
    }
    const v = this.form.getRawValue();
    const body: Record<string, unknown> = {
      fullName: v.fullName,
      gender: v.gender,
      registrationCharge: Number(v.registrationCharge),
      subscriptionMonths: Number(v.subscriptionMonths),
      courseIds: this.selectedCourseIds(),
      batchIds: this.selectedBatchIds(),
      schoolClassId: v.schoolClassId || null,
      boardId: v.boardId || null,
      dateOfBirth: v.dateOfBirth || null,
      paymentDate: toYmd(v.paymentDate),
      joiningDate: toYmd(v.joiningDate),
      email: v.email || null,
      phone: v.phone || null,
      emergencyContact: v.emergencyContact || null,
      status: v.status,
      photoFileId: this.photoId(),
      branchId: this.routeBranchId || v.branchId
    };
    if (!this.editingId()) {
      body['paidAmount'] = Number(v.paidAmount);
    }
    const req = this.editingId()
      ? this.api.put(`/students/${this.editingId()}`, body)
      : this.api.post('/students', body);
    req.subscribe({
      next: () => {
        this.photos.clearDraft('member-photo');
        this.photos.clearSession();
        this.formOpen.set(false);
        this.alerts.success(this.i18n.t('common.saved'));
        this.load(this.page());
      },
      error: (e) => {
        this.error.set(apiErrorMessage(e));
        this.alerts.error(apiErrorMessage(e));
      }
    });
  }

  async remove(id: string): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('common.deleteConfirm')))) return;
    this.api.delete(`/students/${id}`).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('common.deleted'));
        this.load(this.page());
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  async restore(id: string): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('members.renewConfirm')))) return;
    this.api.post(`/students/${id}/restore`, {}).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('members.renewed'));
        this.load(this.page());
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  async deactivate(id: string): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('members.deactivateConfirm')))) return;
    this.api.post(`/students/${id}/login-status`, { status: 'INACTIVE' }).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('members.deactivatedLogin'));
        this.load(this.page());
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  async activate(id: string): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('members.activateConfirm')))) return;
    this.api.post(`/students/${id}/login-status`, { status: 'ACTIVE' }).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('members.activatedLogin'));
        this.load(this.page());
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  onFilterBranchChange(value: string): void {
    this.filterBranch.set(value);
    this.filterCourse.set('');
    this.loadCatalog();
    this.load(1);
  }

  goImport(): void {
    const branchId = this.routeBranchId;
    void this.router.navigate(branchId ? ['/branches', branchId, 'students', 'import'] : ['/students/import']);
  }

  downloadList(): void {
    this.api.download('/students/export', { branchId: this.routeBranchId || this.filterBranch() || undefined }).subscribe({
      next: (blob) => {
        try {
          triggerBrowserDownload(blob, 'students.xlsx');
        } catch (e) {
          this.alerts.error(apiErrorMessage(e));
        }
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }
}
