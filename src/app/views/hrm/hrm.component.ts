import { NgClass } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  FormCheckComponent,
  FormCheckInputDirective,
  FormCheckLabelDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AlertService } from '../../core/alert.service';
import { InrPipe } from '../../core/inr.pipe';
import { onBranchRouteChange } from '../../core/on-branch-route';
import { TPipe } from '../../core/t.pipe';
import { EmptyComponent } from '../../shared/empty.component';
import { PagerComponent } from '../../shared/pager.component';

export type AttendanceStatus = 'AVAILABLE' | 'LEAVE' | 'HALF_LEAVE' | 'HOLIDAY_CLOSE' | 'WEEKEND';

export type HrmCell = {
  date: string;
  status: AttendanceStatus | null;
  locked: boolean;
  lockReason: 'beforeJoin' | 'weekend' | 'readonly' | null;
  isFuture: boolean;
};

export type HrmRow = {
  id: string;
  fullName: string;
  role: string;
  branchName: string;
  joiningDate: string;
  canEdit: boolean;
  salary: number;
  payable: number;
  cells: HrmCell[];
};

export type HrmDay = {
  date: string;
  day: number;
  weekday: number;
  isSunday: boolean;
  isToday: boolean;
  isFuture: boolean;
};

export type HrmGrid = {
  year: number;
  month: number;
  sundayWeekend: boolean;
  minYearMonth: { year: number; month: number };
  maxYearMonth: { year: number; month: number };
  days: HrmDay[];
  items: HrmRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const STATUSES: AttendanceStatus[] = ['AVAILABLE', 'LEAVE', 'HALF_LEAVE', 'HOLIDAY_CLOSE', 'WEEKEND'];
const LEGEND: AttendanceStatus[] = ['AVAILABLE', 'LEAVE', 'HALF_LEAVE', 'HOLIDAY_CLOSE', 'WEEKEND'];

@Component({
  selector: 'app-hrm',
  templateUrl: './hrm.component.html',
  styleUrl: './hrm.component.scss',
  imports: [
    NgClass,
    FormsModule,
    ButtonDirective,
    CardComponent,
    CardBodyComponent,
    FormCheckComponent,
    FormCheckInputDirective,
    FormCheckLabelDirective,
    IconDirective,
    InrPipe,
    TPipe,
    EmptyComponent,
    PagerComponent
  ]
})
export class HrmComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly alerts = inject(AlertService);
  private filtersReady = false;

  readonly data = signal<HrmGrid | null>(null);
  readonly page = signal(1);
  readonly search = signal('');
  readonly year = signal(new Date().getFullYear());
  readonly month = signal(new Date().getMonth() + 1);
  readonly sundayWeekend = signal(false);
  readonly error = signal('');
  readonly saving = signal<string | null>(null);
  readonly statuses = STATUSES;
  readonly legend = LEGEND;

  constructor() {
    onBranchRouteChange(() => {
      this.search.set('');
      this.load(1);
    });
  }

  get routeBranchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || undefined;
  }

  get titleKey(): string {
    if (this.routeBranchId) return 'nav.hrm';
    if (this.auth.isAdmin() && this.auth.isMultiBranch()) return 'nav.allHrm';
    return 'nav.hrm';
  }

  years(): number[] {
    const grid = this.data();
    const min = grid?.minYearMonth.year ?? this.year();
    const max = grid?.maxYearMonth.year ?? this.year();
    const out: number[] = [];
    for (let y = min; y <= max; y += 1) out.push(y);
    return out;
  }

  months(): number[] {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }

  monthDisabled(m: number): boolean {
    const grid = this.data();
    if (!grid) return false;
    const y = this.year();
    const key = y * 100 + m;
    return (
      key < grid.minYearMonth.year * 100 + grid.minYearMonth.month ||
      key > grid.maxYearMonth.year * 100 + grid.maxYearMonth.month
    );
  }

  statusLabel(status: AttendanceStatus): string {
    switch (status) {
      case 'AVAILABLE':
        return 'hrm.available';
      case 'LEAVE':
        return 'hrm.leave';
      case 'HALF_LEAVE':
        return 'hrm.halfLeave';
      case 'HOLIDAY_CLOSE':
        return 'hrm.holiday';
      default:
        return 'hrm.weekend';
    }
  }

  optionDisabled(cell: HrmCell, status: AttendanceStatus): boolean {
    if (status === 'WEEKEND') return true;
    if (cell.isFuture && status === 'AVAILABLE') return true;
    return false;
  }

  showStatusOption(cell: HrmCell, status: AttendanceStatus): boolean {
    if (status !== 'WEEKEND') return true;
    return cell.status === 'WEEKEND';
  }

  cellClass(status: AttendanceStatus | null): string {
    return `ff-att ff-att-${status ?? 'empty'}`;
  }

  dayClass(day: HrmDay): Record<string, boolean> {
    return {
      'ff-hrm-day': true,
      'is-today': day.isToday,
      'is-sunday': day.isSunday,
      'is-week-start': day.weekday === 1
    };
  }

  runSearch(): void {
    this.load(1);
  }

  onYearChange(value: string | number): void {
    this.filtersReady = true;
    this.year.set(Number(value));
    if (this.monthDisabled(this.month())) {
      const first = this.months().find((m) => !this.monthDisabled(m));
      if (first) this.month.set(first);
    }
    this.load(1);
  }

  onMonthChange(value: string | number): void {
    this.filtersReady = true;
    this.month.set(Number(value));
    this.load(1);
  }

  onWeekendToggle(checked: boolean): void {
    this.sundayWeekend.set(checked);
    this.api.put('/hrm/settings', { sundayWeekend: checked }).subscribe({
      next: () => this.load(this.page()),
      error: (e) => {
        this.sundayWeekend.set(!checked);
        this.alerts.error(apiErrorMessage(e));
      }
    });
  }

  load(page = 1): void {
    this.page.set(page);
    this.api
      .get<HrmGrid>('/hrm', {
        page,
        pageSize: 50,
        search: this.search().trim(),
        year: this.filtersReady ? this.year() : undefined,
        month: this.filtersReady ? this.month() : undefined,
        branchId: this.routeBranchId
      })
      .subscribe({
        next: (d) => {
          this.filtersReady = true;
          this.data.set(d);
          this.year.set(d.year);
          this.month.set(d.month);
          this.sundayWeekend.set(d.sundayWeekend);
          this.error.set('');
        },
        error: (e) => this.error.set(apiErrorMessage(e))
      });
  }

  onStatusChange(row: HrmRow, cell: HrmCell, value: string | AttendanceStatus | null): void {
    if (cell.locked || this.saving() === `${row.id}:${cell.date}`) return;
    const status = value === '' || value == null ? null : (value as AttendanceStatus);
    if (status === cell.status) return;
    if (status == null && !cell.isFuture) return;
    const previous = cell.status;
    cell.status = status;
    this.saving.set(`${row.id}:${cell.date}`);
    this.api
      .put<{ employeeId: string; payable: number; cell: HrmCell }>('/hrm/attendance', {
        employeeId: row.id,
        date: cell.date,
        status
      })
      .subscribe({
        next: (res) => {
          this.saving.set(null);
          row.payable = res.payable;
          Object.assign(cell, res.cell);
          this.data.update((d) =>
            d ? { ...d, items: d.items.map((item) => (item.id === row.id ? { ...item } : item)) } : d
          );
        },
        error: (e) => {
          this.saving.set(null);
          cell.status = previous;
          this.data.update((d) => (d ? { ...d, items: [...d.items] } : d));
          this.alerts.error(apiErrorMessage(e));
        }
      });
  }
}
