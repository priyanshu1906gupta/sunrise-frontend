import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { BadgeComponent, CardComponent, TableDirective } from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { InrPipe } from '../../core/inr.pipe';
import { TPipe } from '../../core/t.pipe';
import { EmptyComponent } from '../../shared/empty.component';
import { PagerComponent } from '../../shared/pager.component';

@Component({
  selector: 'app-my-payments',
  templateUrl: './my-payments.component.html',
  imports: [DatePipe, BadgeComponent, CardComponent, TableDirective, InrPipe, TPipe, EmptyComponent, PagerComponent]
})
export class MyPaymentsComponent {
  private readonly api = inject(ApiService);
  readonly student = signal<any>(null);
  readonly error = signal('');
  readonly page = signal(1);
  readonly pageSize = 20;

  constructor() {
    this.api.get<any>('/students/me').subscribe({
      next: (d) => this.student.set(d),
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  payments(): any[] {
    const rows = this.student()?.payments;
    return Array.isArray(rows) ? rows : [];
  }

  paged(): any[] {
    const start = (this.page() - 1) * this.pageSize;
    return this.payments().slice(start, start + this.pageSize);
  }

  totalPages(): number {
    return Math.ceil(this.payments().length / this.pageSize) || 0;
  }
}
