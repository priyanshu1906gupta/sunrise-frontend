import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ButtonDirective, CardBodyComponent, CardComponent, FormControlDirective, FormDirective, FormLabelDirective,
  ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TableDirective
} from '@coreui/angular';
import { AlertService } from '../../core/alert.service';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { toYmd } from '../../core/date';
import { InrPipe } from '../../core/inr.pipe';
import { Paginated } from '../../core/models';
import { TPipe } from '../../core/t.pipe';
import { IconDirective } from '@coreui/icons-angular';
import { ModalCloseComponent } from '../../shared/modal-close.component';
import { onBranchRouteChange } from '../../core/on-branch-route';
import { EmptyComponent } from '../../shared/empty.component';
import { PagerComponent } from '../../shared/pager.component';
import { FallbackSrcDirective } from '../../shared/fallback-src.directive';

@Component({
  selector: 'app-payments',
  templateUrl: './payments.component.html',
  imports: [
    DatePipe, ReactiveFormsModule, ButtonDirective, CardComponent, CardBodyComponent, FormDirective, FormControlDirective,
    FormLabelDirective, ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    TableDirective, InrPipe, TPipe, EmptyComponent, PagerComponent, IconDirective, ModalCloseComponent, FallbackSrcDirective
  ]
})
export class PaymentsComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private loadGen = 0;

  readonly list = signal<Paginated<any> | null>(null);
  readonly search = signal('');
  readonly error = signal('');
  readonly payOpen = signal(false);
  readonly receipt = signal<any>(null);
  readonly current = signal<any>(null);
  readonly form = this.fb.nonNullable.group({
    paidAmount: [0, Validators.required],
    paymentDate: [toYmd(new Date()), Validators.required],
    paymentMode: ['CASH' as 'CASH' | 'ONLINE', Validators.required]
  });

  get branchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || this.auth.branches()[0]?.id;
  }

  get branchName(): string | undefined {
    const id = this.route.snapshot.paramMap.get('branchId');
    return this.auth.branches().find((b) => b.id === id)?.name;
  }

  constructor() {
    onBranchRouteChange(() => {
      this.search.set('');
      this.load(1);
    });
  }

  runSearch(): void {
    this.load(1);
  }

  load(page = 1): void {
    const gen = ++this.loadGen;
    this.api.get<Paginated<any>>('/students/due', {
      page, pageSize: 20, search: this.search().trim(), branchId: this.branchId
    }).subscribe({
      next: (d) => {
        if (gen !== this.loadGen) return;
        this.list.set(d);
      },
      error: (e) => {
        if (gen !== this.loadGen) return;
        this.error.set(apiErrorMessage(e));
      }
    });
  }

  openPay(m: any): void {
    this.current.set(m);
    this.api.get<any>(`/students/${m['id']}`).subscribe((d) => {
      this.current.set(d);
      this.form.reset({ paidAmount: Number(d['dueAmount']) || 0, paymentDate: toYmd(new Date()), paymentMode: 'CASH' });
      this.payOpen.set(true);
    });
  }

  savePay(): void {
    const m = this.current();
    if (!m || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.api.post<{ receipt: any }>(`/students/${m['id']}/payments`, {
      paidAmount: Number(this.form.controls.paidAmount.value),
      paymentDate: toYmd(this.form.controls.paymentDate.value),
      paymentMode: this.form.controls.paymentMode.value
    }).subscribe({
      next: (res) => {
        this.payOpen.set(false);
        this.receipt.set(res.receipt);
        this.alerts.success(this.i18n.t('common.saved'));
        this.load();
      },
      error: (e) => {
        const message = apiErrorMessage(e);
        this.error.set(message);
        this.alerts.error(message);
      }
    });
  }

  print(): void {
    window.print();
  }
}
