import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  RowComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { onBranchRouteChange } from '../../core/on-branch-route';
import { InrPipe } from '../../core/inr.pipe';
import { TPipe } from '../../core/t.pipe';

interface CalEvent {
  id: string;
  type: string;
  title: string;
  date: string;
  branchName?: string;
  amount?: number;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ymdApi(value: string): string {
  return String(value).slice(0, 10);
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
  imports: [
    DatePipe,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    ButtonDirective,
    TPipe,
    InrPipe,
    RowComponent,
    ColComponent,
    BadgeComponent,
    IconDirective
  ]
})
export class CalendarComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly cursor = signal(new Date());
  readonly events = signal<CalEvent[]>([]);
  readonly selected = signal<Date>(new Date());
  readonly weekKeys = ['calendar.sun', 'calendar.mon', 'calendar.tue', 'calendar.wed', 'calendar.thu', 'calendar.fri', 'calendar.sat'];

  readonly cells = computed(() => {
    const cur = this.cursor();
    const start = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const padDays = start.getDay();
    const days: { date: Date; inMonth: boolean; key: string }[] = [];
    for (let i = 0; i < padDays; i++) {
      const date = new Date(cur.getFullYear(), cur.getMonth(), i - padDays + 1);
      days.push({ date, inMonth: false, key: ymdLocal(date) });
    }
    for (let d = 1; d <= end.getDate(); d++) {
      const date = new Date(cur.getFullYear(), cur.getMonth(), d);
      days.push({ date, inMonth: true, key: ymdLocal(date) });
    }
    return days;
  });

  readonly selectedEvents = computed(() => this.eventsOn(this.selected()));

  get branchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || undefined;
  }

  get branchName(): string | undefined {
    const id = this.branchId;
    return this.auth.branches().find((b) => b.id === id)?.name;
  }

  constructor() {
    onBranchRouteChange(() => this.load());
  }

  load(): void {
    const cur = this.cursor();
    const from = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-01`;
    const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const to = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`;
    this.api.get<CalEvent[]>('/calendar', { from, to, branchId: this.branchId }).subscribe((e) => {
      this.events.set(e);
      this.selectDefault();
    });
  }

  prev(): void {
    const c = this.cursor();
    this.cursor.set(new Date(c.getFullYear(), c.getMonth() - 1, 1));
    this.load();
  }

  next(): void {
    const c = this.cursor();
    this.cursor.set(new Date(c.getFullYear(), c.getMonth() + 1, 1));
    this.load();
  }

  today(): void {
    const now = new Date();
    this.cursor.set(new Date(now.getFullYear(), now.getMonth(), 1));
    this.selected.set(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    this.load();
  }

  pick(date: Date): void {
    this.selected.set(date);
  }

  isToday(date: Date): boolean {
    return ymdLocal(date) === ymdLocal(new Date());
  }

  isSelected(date: Date): boolean {
    return ymdLocal(date) === ymdLocal(this.selected());
  }

  eventsOn(date: Date): CalEvent[] {
    const key = ymdLocal(date);
    return this.events().filter((e) => ymdApi(e.date) === key);
  }

  typeClass(type: string): string {
    switch (type) {
      case 'MEMBER_PAYMENT':
        return 'success';
      case 'MEMBER_PAYMENT_PREV':
        return 'primary';
      case 'EMPLOYEE_SALARY':
      case 'EMPLOYEE_SALARY_PAID':
        return 'info';
      default:
        return 'danger';
    }
  }

  typeLabel(type: string): string {
    switch (type) {
      case 'MEMBER_PAYMENT':
        return 'calendar.paymentDue';
      case 'MEMBER_PAYMENT_PREV':
        return 'calendar.paymentMade';
      case 'EMPLOYEE_SALARY':
        return 'calendar.salaryDue';
      case 'EMPLOYEE_SALARY_PAID':
        return 'calendar.salaryPaid';
      default:
        return 'calendar.expense';
    }
  }

  private selectDefault(): void {
    const cur = this.cursor();
    const now = new Date();
    if (now.getFullYear() === cur.getFullYear() && now.getMonth() === cur.getMonth()) {
      this.selected.set(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    } else {
      this.selected.set(new Date(cur.getFullYear(), cur.getMonth(), 1));
    }
  }
}
