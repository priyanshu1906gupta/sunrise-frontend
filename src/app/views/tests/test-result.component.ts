import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective, CardBodyComponent, CardComponent, TableDirective } from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { TPipe } from '../../core/t.pipe';
import { TestResult, formatClock } from './test.models';

@Component({
  selector: 'app-test-result',
  templateUrl: './test-result.component.html',
  styleUrl: './test-result.component.scss',
  imports: [ButtonDirective, CardComponent, CardBodyComponent, TableDirective, RouterLink, TPipe]
})
export class TestResultComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly testId = this.route.snapshot.paramMap.get('id')!;
  readonly result = signal<TestResult | null>(null);
  readonly error = signal('');

  constructor() {
    this.api.get<TestResult>(`/tests/${this.testId}/result`).subscribe({
      next: (row) => this.result.set(row),
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  clock(seconds: number): string {
    return formatClock(seconds);
  }
}
