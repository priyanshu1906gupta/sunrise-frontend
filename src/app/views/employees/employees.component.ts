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
  RowComponent,
  TableDirective
} from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { AlertService } from '../../core/alert.service';
import { I18nService } from '../../core/i18n.service';
import { toYmd } from '../../core/date';
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

@Component({
  selector: 'app-employees',
  templateUrl: './employees.component.html',
  imports: [
    DatePipe, ReactiveFormsModule, ButtonDirective, CardComponent, CardBodyComponent, ColComponent, RowComponent,
    FormDirective, FormControlDirective, FormLabelDirective, ModalComponent, ModalHeaderComponent,
    ModalTitleDirective, ModalBodyComponent, ModalFooterComponent, TableDirective, InrPipe, TPipe, EmptyComponent,
    PagerComponent, PhotoUploadComponent, IconDirective, ModalCloseComponent, FallbackSrcDirective
  ]
})
export class EmployeesComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);
  readonly photos = inject(PhotoPickerService);

  readonly list = signal<Paginated<any> | null>(null);
  readonly page = signal(1);
  readonly search = signal('');
  readonly filterBranch = signal('');
  readonly error = signal('');
  readonly formOpen = signal(false);
  readonly detail = signal<any>(null);
  readonly photoId = signal<string | null>(null);
  readonly photoUrl = signal<string | null>(null);
  readonly aadhaarId = signal<string | null>(null);
  readonly aadhaarUrl = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly subjects = signal<{ id: string; name: string }[]>([]);

  readonly form = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    gender: ['MALE', Validators.required],
    role: ['TEACHER', Validators.required],
    subjectId: [''],
    salary: [0, Validators.required],
    salaryDate: [toYmd(new Date()), Validators.required],
    joiningDate: [toYmd(new Date()), Validators.required],
    email: ['', Validators.email],
    phone: ['', Validators.required],
    emergencyContact: [''],
    address: [''],
    branchId: ['']
  });

  get routeBranchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || undefined;
  }

  constructor() {
    onBranchRouteChange(() => {
      this.search.set('');
      this.filterBranch.set('');
      this.loadSubjects();
      this.load(1);
    });
    this.form.controls.role.valueChanges.subscribe((role) => this.syncEmailRequirement(role));
    const restore = this.photos.takeRestore('employees');
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

  get roleNeedsLogin(): boolean {
    const role = this.form.controls.role.value;
    return role === 'MANAGER' || role === 'TEACHER';
  }

  private syncEmailRequirement(role: string): void {
    const email = this.form.controls.email;
    email.setValidators(role === 'MANAGER' || role === 'TEACHER' ? [Validators.required, Validators.email] : [Validators.email]);
    email.updateValueAndValidity({ emitEvent: false });
  }

  loadSubjects(): void {
    this.api.get<{ subjects: { id: string; name: string }[] }>('/catalogs').subscribe({
      next: (d) => this.subjects.set(d.subjects || []),
      error: () => this.subjects.set([])
    });
  }

  onFormVisible(visible: boolean): void {
    this.photos.onModalVisible(visible, (v) => this.formOpen.set(v));
  }

  runSearch(): void {
    this.load(1);
  }

  load(page = 1): void {
    this.page.set(page);
    this.api.get<Paginated<any>>('/employees', {
      page, pageSize: 20, search: this.search().trim(),
      branchId: this.routeBranchId || this.filterBranch() || undefined
    }).subscribe({ next: (d) => this.list.set(d), error: (e) => this.error.set(apiErrorMessage(e)) });
  }

  openAdd(): void {
    this.editingId.set(null);
    const draft = this.photos.peekDraft('employee-photo');
    this.photoId.set(draft?.id ?? null);
    this.photoUrl.set(draft?.url ?? null);
    const aadhaar = this.photos.peekDraft('employee-aadhaar');
    this.aadhaarId.set(aadhaar?.id ?? null);
    this.aadhaarUrl.set(aadhaar?.url ?? null);
    this.error.set('');
    this.form.reset({
      fullName: '', gender: 'MALE', role: 'TEACHER', subjectId: '', salary: 0,
      salaryDate: toYmd(new Date()),
      joiningDate: toYmd(new Date()),
      email: '', phone: '', emergencyContact: '', address: '',
      branchId: this.routeBranchId || this.auth.branches()[0]?.id || ''
    });
    this.syncEmailRequirement('TEACHER');
    this.formOpen.set(true);
    this.photos.noteHost('employees', null);
  }

  openDetail(id: string): void {
    this.api.get<any>(`/employees/${id}`).subscribe({
      next: (d) => this.detail.set(d),
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  openEdit(id: string, restoreForm?: Record<string, unknown>): void {
    this.api.get<any>(`/employees/${id}`).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.editFromDetail();
        if (restoreForm) this.form.patchValue(restoreForm as never);
      },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  editFromDetail(): void {
    const d = this.detail();
    if (!d) return;
    this.editingId.set(d['id'] as string);
    const photoDraft = this.photos.peekDraft('employee-photo');
    this.photoId.set(photoDraft?.id || (d['photoFileId'] as string) || null);
    this.photoUrl.set(photoDraft?.url || (d['photoUrl'] as string) || null);
    const aadhaarDraft = this.photos.peekDraft('employee-aadhaar');
    this.aadhaarId.set(aadhaarDraft?.id || (d['aadhaarFileId'] as string) || null);
    this.aadhaarUrl.set(aadhaarDraft?.url || (d['aadhaarUrl'] as string) || null);
    this.error.set('');
    this.form.patchValue({
      fullName: d['fullName'] as string,
      gender: d['gender'] as string,
      role: (d['role'] as string) || 'TEACHER',
      subjectId: (d['subjectId'] as string) || '',
      salary: d['salary'] as number,
      salaryDate: toYmd(d['salaryDate']),
      joiningDate: toYmd(d['joiningDate']),
      email: (d['email'] as string) || '',
      phone: d['phone'] as string,
      emergencyContact: (d['emergencyContact'] as string) || '',
      address: (d['address'] as string) || '',
      branchId: d['branchId'] as string
    });
    this.syncEmailRequirement((d['role'] as string) || 'TEACHER');
    this.detail.set(null);
    this.formOpen.set(true);
    this.photos.noteHost('employees', d['id'] as string);
  }

  save(): void {
    this.syncEmailRequirement(this.form.controls.role.value);
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const body = {
      fullName: v.fullName,
      gender: v.gender,
      role: v.role,
      subjectId: v.subjectId || null,
      salary: Number(v.salary),
      salaryDate: toYmd(v.salaryDate),
      joiningDate: toYmd(v.joiningDate),
      email: v.email ? v.email.trim().toLowerCase() : null,
      phone: v.phone,
      emergencyContact: v.emergencyContact || null,
      address: v.address || null,
      photoFileId: this.photoId(),
      aadhaarFileId: this.aadhaarId(),
      branchId: this.routeBranchId || v.branchId
    };
    const req = this.editingId() ? this.api.put(`/employees/${this.editingId()}`, body) : this.api.post('/employees', body);
    req.subscribe({ next: () => {
      this.photos.clearDraft('employee-photo');
      this.photos.clearDraft('employee-aadhaar');
      this.photos.clearSession();
      this.formOpen.set(false);
      this.alerts.success(this.i18n.t('common.saved'));
      this.load(this.page());
    }, error: (e) => {
      this.error.set(apiErrorMessage(e));
      this.alerts.error(apiErrorMessage(e));
    } });
  }

  async remove(id: string): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('common.deleteConfirm')))) return;
    this.api.delete(`/employees/${id}`).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('common.deleted'));
        this.load(this.page());
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  canResetManager(row: { role?: string }): boolean {
    return this.auth.isAdmin() && !this.routeBranchId && (row.role === 'MANAGER' || row.role === 'TEACHER');
  }

  async resetManager(id: string): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('employees.resetConfirm')))) return;
    this.api.post(`/employees/${id}/reset-password`, {}).subscribe({
      next: () => this.alerts.success(this.i18n.t('employees.resetDone')),
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }
}
