import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { CardBodyComponent, CardComponent, TableDirective } from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AlertService } from '../../core/alert.service';
import { TPipe } from '../../core/t.pipe';
import { EmptyComponent } from '../../shared/empty.component';
import { SubscriptionRow } from './subscription.models';

@Component({
  selector: 'app-subscription',
  templateUrl: './subscription.component.html',
  imports: [DatePipe, CardComponent, CardBodyComponent, TableDirective, TPipe, EmptyComponent]
})
export class SubscriptionComponent {
  private readonly api = inject(ApiService);
  private readonly alerts = inject(AlertService);
  readonly items = signal<SubscriptionRow[]>([]);
  readonly loaded = signal(false);

  constructor() {
    this.api.get<{ items: SubscriptionRow[] }>('/subscription').subscribe({
      next: (res) => {
        this.items.set(res.items ?? []);
        this.loaded.set(true);
      },
      error: (e) => {
        this.loaded.set(true);
        this.alerts.error(apiErrorMessage(e));
      }
    });
  }
}
