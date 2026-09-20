import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CardBodyComponent, CardComponent } from '@coreui/angular';
import { ApiService } from '../../core/api.service';
import { TPipe } from '../../core/t.pipe';

@Component({
  selector: 'app-terms',
  template: `
    <h2 class="h4 ff-toolbar mb-3">{{ data()?.title || ('nav.terms' | t) }}</h2>
    <c-card><c-card-body>
      @if (data(); as d) {
        <p class="text-body-secondary">Trial until {{ d.trialEndsAt | date:'dd MMM yyyy' }} @if (d.trialActive) { (active) }</p>
        <pre class="mb-0" style="white-space:pre-wrap;font-family:inherit">{{ d.body }}</pre>
      }
    </c-card-body></c-card>
  `,
  imports: [CardComponent, CardBodyComponent, TPipe, DatePipe]
})
export class TermsComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly data = signal<{ title: string; body: string; trialEndsAt: string; trialActive: boolean } | null>(null);
  ngOnInit(): void {
    this.api.get<typeof this.data extends () => infer R ? NonNullable<R> : never>('/content/terms').subscribe((d) => this.data.set(d));
  }
}
