import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  TableDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { AlertService } from '../../core/alert.service';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { I18nService } from '../../core/i18n.service';
import { Paginated } from '../../core/models';
import { TPipe } from '../../core/t.pipe';
import { LangSwitchComponent } from '../../shared/lang-switch.component';
import { EmptyComponent } from '../../shared/empty.component';
import { PagerComponent } from '../../shared/pager.component';
import { SubscriptionRow } from './subscription.models';

interface SuperRow extends SubscriptionRow {
  userId: string;
  ownerName: string;
  phone: string;
}

const PAGE_SIZE = 20;

@Component({
  selector: 'app-super-subscription',
  templateUrl: './super-subscription.component.html',
  host: { class: 'ff-super-page' },
  imports: [
    DatePipe,
    ButtonDirective,
    CardComponent,
    CardBodyComponent,
    TableDirective,
    IconDirective,
    TPipe,
    LangSwitchComponent,
    EmptyComponent,
    PagerComponent
  ]
})
export class SuperSubscriptionComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly alerts = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nService);

  readonly key = this.route.snapshot.paramMap.get('key') || '';
  readonly denied = signal(false);
  readonly list = signal<Paginated<SuperRow> | null>(null);
  readonly search = signal('');
  readonly ending = signal('');
  readonly sort = signal<'endingSoon' | 'newest'>('endingSoon');
  readonly extendOptions = [
    { months: 1, labelKey: 'subscription.month1' },
    { months: 2, labelKey: 'subscription.month2' },
    { months: 3, labelKey: 'subscription.month3' },
    { months: 6, labelKey: 'subscription.month6' },
    { months: 12, labelKey: 'subscription.year1' }
  ];

  constructor() {
    this.load(1);
  }

  load(page = 1): void {
    if (!this.key) {
      this.denied.set(true);
      return;
    }
    this.api
      .get<Paginated<SuperRow>>('/super/subscriptions', {
        key: this.key,
        page,
        pageSize: PAGE_SIZE,
        search: this.search().trim(),
        ending: this.ending() || undefined,
        sort: this.sort()
      })
      .subscribe({
        next: (res) => {
          this.denied.set(false);
          this.list.set(res);
        },
        error: (e) => {
          this.list.set(null);
          if ((e as { status?: number }).status === 404) {
            this.denied.set(true);
            return;
          }
          this.alerts.error(apiErrorMessage(e));
        }
      });
  }

  runSearch(): void {
    this.load(1);
  }

  async extend(row: SuperRow, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const months = Number(select.value);
    select.value = '';
    if (!months) return;
    const ok = await this.confirm.ask(this.i18n.t('subscription.extendConfirm'));
    if (!ok) return;
    this.api.put<SuperRow>(`/super/subscriptions/${row.companyId}/extend`, { months, key: this.key }).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('subscription.extended'));
        this.load(this.list()?.page || 1);
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  async setActive(row: SuperRow, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const active = select.value === '1';
    if (active === row.active) return;
    const ok = await this.confirm.ask(
      this.i18n.t(active ? 'subscription.reactivateConfirm' : 'subscription.deactivateConfirm')
    );
    if (!ok) {
      select.value = row.active ? '1' : '0';
      return;
    }
    this.api.put<SuperRow>(`/super/subscriptions/${row.companyId}/status`, { active, key: this.key }).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('common.saved'));
        this.load(this.list()?.page || 1);
      },
      error: (e) => {
        select.value = row.active ? '1' : '0';
        this.alerts.error(apiErrorMessage(e));
      }
    });
  }

  async resetPassword(row: SuperRow): Promise<void> {
    const ok = await this.confirm.ask(this.i18n.t('subscription.resetConfirm'));
    if (!ok) return;
    this.api.post(`/super/subscriptions/${row.userId}/reset-password?key=${encodeURIComponent(this.key)}`, {}).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('subscription.resetDone'));
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }
}
