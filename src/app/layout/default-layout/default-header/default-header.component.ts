import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  BadgeComponent,
  ColorModeService,
  ContainerComponent,
  DropdownComponent,
  DropdownDividerDirective,
  DropdownHeaderDirective,
  DropdownItemDirective,
  DropdownMenuDirective,
  DropdownToggleDirective,
  HeaderComponent,
  HeaderNavComponent,
  HeaderTogglerDirective,
  SidebarToggleDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { AuthService } from '../../../core/auth.service';
import { ApiService } from '../../../core/api.service';
import { LangSwitchComponent } from '../../../shared/lang-switch.component';
import { I18nService } from '../../../core/i18n.service';
import { TPipe } from '../../../core/t.pipe';
import { FallbackSrcDirective } from '../../../shared/fallback-src.directive';
import { Paginated } from '../../../core/models';

interface Notif {
  id: string;
  title: string;
  message: string;
  type: string;
  entityId: string;
  branchId: string | null;
  dueDate?: string;
  read?: boolean;
  readAt?: string | null;
}

const NOTIF_PAGE_SIZE = 10;
const SUBSCRIPTION_WARN_DAYS = 15;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysUntil(value: string | undefined | null): number | null {
  if (!value) return null;
  const target = startOfDay(new Date(value));
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
}

@Component({
  selector: 'app-default-header',
  templateUrl: './default-header.component.html',
  imports: [
    DatePipe,
    ContainerComponent,
    HeaderTogglerDirective,
    SidebarToggleDirective,
    IconDirective,
    HeaderNavComponent,
    RouterLink,
    NgTemplateOutlet,
    DropdownComponent,
    DropdownToggleDirective,
    DropdownMenuDirective,
    DropdownHeaderDirective,
    DropdownItemDirective,
    BadgeComponent,
    DropdownDividerDirective,
    LangSwitchComponent,
    TPipe,
    FallbackSrcDirective
  ]
})
export class DefaultHeaderComponent extends HeaderComponent {
  readonly #colorModeService = inject(ColorModeService);
  readonly auth = inject(AuthService);
  readonly api = inject(ApiService);
  readonly router = inject(Router);
  readonly i18n = inject(I18nService);
  readonly colorMode = this.#colorModeService.colorMode;

  readonly colorModes = computed(() => {
    this.i18n.lang();
    return [
      { name: 'light', text: this.i18n.t('theme.light'), icon: 'cilSun' },
      { name: 'dark', text: this.i18n.t('theme.dark'), icon: 'cilMoon' },
      { name: 'auto', text: this.i18n.t('theme.auto'), icon: 'cilContrast' }
    ];
  });

  readonly icons = computed(() => {
    const currentMode = this.colorMode();
    return this.colorModes().find((mode) => mode.name === currentMode)?.icon ?? 'cilSun';
  });

  readonly sidebarId = input('sidebar1');
  readonly notifications = signal<Notif[]>([]);
  readonly notifPage = signal(1);
  readonly notifTotalPages = signal(0);
  readonly notifTotal = signal(0);
  readonly unreadCount = signal(0);
  readonly notifCount = computed(() => this.unreadCount());
  readonly subscriptionDaysLeft = computed(() => {
    const company = this.auth.me()?.company;
    return daysUntil(company?.subscriptionEndAt ?? company?.trialEndsAt);
  });
  readonly subscriptionWarning = computed(() => {
    this.i18n.lang();
    this.i18n.dict();
    const days = this.subscriptionDaysLeft();
    if (days === null || days < 0 || days > SUBSCRIPTION_WARN_DAYS) return null;
    if (days === 0) return this.i18n.t('header.subscriptionEndsToday');
    return this.i18n.t('header.subscriptionWarning').replace('{n}', String(days));
  });
  readonly showSubscriptionWarn = computed(() => this.subscriptionWarning() !== null);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    super();
    this.refreshNotifications(1);
    const timer = setInterval(() => this.refreshNotifications(), 30_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  refreshNotifications(page = this.notifPage()): void {
    this.api
      .get<Paginated<Notif> & { unreadCount?: number; count?: number }>('/notifications', {
        page,
        pageSize: NOTIF_PAGE_SIZE
      })
      .subscribe({
        next: (res) => {
          const total = res.total ?? res.items.length;
          if (res.items.length === 0 && (res.page ?? page) > 1 && total > 0) {
            this.refreshNotifications((res.page ?? page) - 1);
            return;
          }
          this.notifications.set(res.items);
          this.notifPage.set(res.page || 1);
          this.notifTotalPages.set(res.totalPages || (total ? Math.ceil(total / NOTIF_PAGE_SIZE) : 0));
          this.notifTotal.set(total);
          this.unreadCount.set(res.unreadCount ?? res.count ?? res.items.filter((n) => !n.read).length);
        },
        error: () => {
          this.notifications.set([]);
          this.notifTotal.set(0);
          this.notifTotalPages.set(0);
          this.unreadCount.set(0);
        }
      });
  }

  notifGo(page: number, ev?: Event): void {
    ev?.stopPropagation();
    ev?.preventDefault();
    if (page < 1 || page > this.notifTotalPages()) return;
    this.refreshNotifications(page);
  }

  iconFor(type: string): string {
    if (type === 'MEMBER_PAYMENT') return 'cilPeople';
    if (type === 'EMPLOYEE_SALARY') return 'cilDollar';
    return 'cilNotes';
  }

  toneFor(type: string): string {
    if (type === 'MEMBER_PAYMENT') return 'primary';
    if (type === 'EMPLOYEE_SALARY') return 'info';
    return 'warning';
  }

  clickNotif(n: Notif): void {
    if (!n.read) {
      this.notifications.update((list) =>
        list.map((item) => (item.id === n.id ? { ...item, read: true, readAt: new Date().toISOString() } : item))
      );
      this.unreadCount.update((count) => Math.max(0, count - 1));
      this.api.put(`/notifications/${n.id}/read`, {}).subscribe({
        next: () => this.refreshNotifications(),
        error: () => this.refreshNotifications()
      });
    }
    const prefix = n.branchId ? `/branches/${n.branchId}` : '';
    if (n.type === 'MEMBER_PAYMENT') {
      void this.router.navigateByUrl(n.branchId ? `${prefix}/students` : '/students');
    } else if (n.type === 'EMPLOYEE_SALARY') {
      void this.router.navigateByUrl(n.branchId ? `${prefix}/employees` : '/employees');
    } else {
      void this.router.navigateByUrl(n.branchId ? `${prefix}/expenses` : '/expenses');
    }
  }
}
