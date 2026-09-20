import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
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
  TemplateIdDirective,
  WidgetStatAComponent
} from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { IconDirective } from '@coreui/icons-angular';
import 'chart.js/auto';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { InrPipe } from '../../core/inr.pipe';
import { TPipe } from '../../core/t.pipe';
import { PhotoUploadComponent } from '../../shared/photo-upload.component';
import { PhotoFormSession, PhotoPickerService } from '../../core/photo-picker.service';
import { PasswordInputComponent } from '../../shared/password-input.component';
import { ModalCloseComponent } from '../../shared/modal-close.component';
import { onBranchRouteChange } from '../../core/on-branch-route';

type BranchRow = { id: string; name: string; income: number; expenses: number; members: number; pending: number };

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [
    ButtonDirective,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    ColComponent,
    RowComponent,
    RouterLink,
    ChartjsComponent,
    InrPipe,
    TPipe,
    ReactiveFormsModule,
    FormDirective,
    FormControlDirective,
    FormLabelDirective,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    PhotoUploadComponent,
    WidgetStatAComponent,
    TemplateIdDirective,
    IconDirective,
    ModalCloseComponent,
    PasswordInputComponent
  ]
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly photos = inject(PhotoPickerService);

  readonly stats = signal<Record<string, unknown> | null>(null);
  readonly year = signal(new Date().getFullYear());
  readonly month = signal(new Date().getMonth() + 1);
  private readonly revenueMonths = signal<{ month: number; income: number; expenses: number }[]>([]);
  private readonly joinedMonths = signal<{ month: number; count: number }[]>([]);
  private readonly branchRows = signal<BranchRow[]>([]);
  readonly error = signal('');
  readonly branchModal = signal(false);
  readonly photoIds = signal<string[]>([]);
  readonly logoId = signal<string | null>(null);

  readonly monthLabels = computed(() => {
    this.i18n.lang();
    const locale = this.i18n.lang() === 'hi' ? 'hi-IN' : 'en-IN';
    return Array.from({ length: 12 }, (_, i) =>
      new Date(2026, i, 1).toLocaleString(locale, { month: 'short' })
    );
  });

  readonly monthOptions = computed(() =>
    this.monthLabels().map((label, i) => ({ value: i + 1, label }))
  );

  readonly chart = computed(() => {
    this.i18n.lang();
    const months = this.revenueMonths();
    const labels = this.monthLabels();
    return {
      labels,
      datasets: [
        { label: this.i18n.t('dashboard.incomeSeries'), backgroundColor: '#2eb85c', data: months.map((m) => m.income) },
        { label: this.i18n.t('dashboard.expensesSeries'), backgroundColor: '#e55353', data: months.map((m) => m.expenses) }
      ]
    };
  });

  readonly paymentMixChart = computed(() => {
    this.i18n.lang();
    const s = this.stats();
    return {
      labels: [this.i18n.t('common.paid'), this.i18n.t('common.unpaid')],
      datasets: [
        {
          data: [Number(s?.['paidStudents'] ?? s?.['paidMembers'] ?? 0), Number(s?.['unpaidStudents'] ?? s?.['unpaidMembers'] ?? 0)],
          backgroundColor: ['#2eb85c', '#e55353']
        }
      ]
    };
  });

  readonly shiftChart = computed(() => {
    this.i18n.lang();
    const s = this.stats();
    return {
      labels: [this.i18n.t('common.morning'), this.i18n.t('common.evening')],
      datasets: [
        {
          data: [Number(s?.['morningMembers'] ?? 0), Number(s?.['eveningMembers'] ?? 0)],
          backgroundColor: ['#2eb85c', '#39b6f9']
        }
      ]
    };
  });

  readonly branchChart = computed(() => {
    this.i18n.lang();
    const rows = this.branchRows();
    return {
      labels: rows.map((r) => r.name),
      datasets: [
        { label: this.i18n.t('dashboard.incomeSeries'), backgroundColor: '#2eb85c', data: rows.map((r) => r.income) },
        { label: this.i18n.t('dashboard.expensesSeries'), backgroundColor: '#e55353', data: rows.map((r) => r.expenses) }
      ]
    };
  });

  readonly branchMembersChart = computed(() => {
    this.i18n.lang();
    const rows = this.branchRows();
    return {
      labels: rows.map((r) => r.name),
      datasets: [
        { label: this.i18n.t('dashboard.activeMembers'), backgroundColor: '#2eb85c', data: rows.map((r) => r.members) },
        { label: this.i18n.t('dashboard.pending'), backgroundColor: '#f9b115', data: rows.map((r) => r.pending) }
      ]
    };
  });

  readonly membersJoinedChart = computed(() => {
    this.i18n.lang();
    const months = this.joinedMonths();
    return {
      labels: this.monthLabels(),
      datasets: [
        {
          label: this.i18n.t('dashboard.membersJoined'),
          data: months.map((m) => m.count),
          borderColor: '#2eb85c',
          backgroundColor: 'rgba(46, 184, 92, 0.18)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#2eb85c',
          pointRadius: 3
        }
      ]
    };
  });

  readonly doughnutOptions = {
    responsive: true,
    plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } } },
    maintainAspectRatio: false
  };

  readonly lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } } },
    scales: {
      x: { ticks: { font: { size: 11 } } },
      y: { beginAtZero: true, ticks: { font: { size: 11 }, precision: 0 } }
    }
  };

  readonly barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } } },
    scales: {
      x: { ticks: { font: { size: 11 } } },
      y: { beginAtZero: true, ticks: { font: { size: 11 } } }
    }
  };

  readonly branchForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    ownerName: ['', Validators.required],
    address: [''],
    phone: [''],
    details: [''],
    managerFirstName: [''],
    managerLastName: [''],
    managerEmail: [''],
    managerPhone: [''],
    managerPassword: ['']
  });

  get branchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || undefined;
  }

  get showAddBranch(): boolean {
    return this.auth.isAdmin() && !this.branchId;
  }

  get showViewBranch(): boolean {
    if (!this.auth.isAdmin()) return false;
    if (this.branchId) return true;
    return !this.auth.isMultiBranch();
  }

  get viewBranchLink(): string {
    const id = this.branchId || this.auth.branches()[0]?.id;
    return id ? `/branches/${id}` : '/dashboard';
  }

  get showBranchChart(): boolean {
    return !this.branchId && this.branchRows().length > 1;
  }

  constructor() {
    onBranchRouteChange(() => this.load());
    const restore = this.photos.takeRestore('dashboard-branch');
    if (restore) queueMicrotask(() => this.restoreSession(restore));
  }

  private restoreSession(session: PhotoFormSession): void {
    this.openAdd();
    if (session.form) this.branchForm.patchValue(session.form as never);
    const extra = session.extra;
    if (typeof extra?.['logoId'] === 'string') this.logoId.set(extra['logoId']);
    if (Array.isArray(extra?.['photoIds'])) this.photoIds.set(extra['photoIds'] as string[]);
  }

  stashPhotoForm(): void {
    this.photos.stash(this.branchForm.getRawValue(), { logoId: this.logoId(), photoIds: this.photoIds() });
  }

  load(): void {
    this.api
      .get<Record<string, unknown>>('/dashboard', { branchId: this.branchId, year: this.year(), month: this.month() })
      .subscribe({
        next: (s) => {
          this.stats.set(s);
          this.revenueMonths.set((s['revenueByMonth'] as { month: number; income: number; expenses: number }[]) || []);
          this.joinedMonths.set(
            ((s['studentsJoinedByMonth'] ?? s['membersJoinedByMonth']) as { month: number; count: number }[]) || []
          );
          this.branchRows.set((s['branchBreakdown'] as BranchRow[]) || []);
        },
        error: (e) => this.error.set(apiErrorMessage(e))
      });
  }

  onBranchVisible(visible: boolean): void {
    this.photos.onModalVisible(visible, (v) => this.branchModal.set(v));
  }

  openAdd(): void {
    this.branchForm.reset({
      name: '',
      ownerName: this.auth.me()?.firstName + ' ' + (this.auth.me()?.lastName ?? ''),
      address: '',
      phone: '',
      details: '',
      managerFirstName: '',
      managerLastName: '',
      managerEmail: '',
      managerPhone: '',
      managerPassword: ''
    });
    this.logoId.set(this.photos.peekDraft('branch-logo')?.id ?? null);
    const extra = this.photos.peekDraft('branch-photos');
    this.photoIds.set(extra?.id ? [extra.id] : []);
    this.branchModal.set(true);
    this.photos.noteHost('dashboard-branch', null);
  }

  saveBranch(): void {
    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      return;
    }
    const v = this.branchForm.getRawValue();
    const body: Record<string, unknown> = {
      name: v.name,
      ownerName: v.ownerName,
      address: v.address || null,
      phone: v.phone || null,
      details: v.details || null,
      logoFileId: this.logoId(),
      photoFileIds: this.photoIds()
    };
    if (v.managerEmail && v.managerPassword) {
      body['manager'] = {
        firstName: v.managerFirstName,
        lastName: v.managerLastName,
        email: v.managerEmail,
        phone: v.managerPhone,
        password: v.managerPassword
      };
    }
    this.api.post('/branches', body).subscribe({
      next: () => {
        this.photos.clearDraft('branch-logo');
        this.photos.clearDraft('branch-photos');
        this.photos.clearSession();
        this.branchModal.set(false);
        this.auth.loadMe().subscribe(() => this.load());
      },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }
}
