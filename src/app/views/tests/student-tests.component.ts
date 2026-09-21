import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective, CardBodyComponent, CardComponent, ColComponent, RowComponent } from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { TPipe } from '../../core/t.pipe';
import { EmptyComponent } from '../../shared/empty.component';
import { AvailableTest } from './test.models';

@Component({
  selector: 'app-student-tests',
  templateUrl: './student-tests.component.html',
  imports: [ButtonDirective, CardComponent, CardBodyComponent, ColComponent, RowComponent, TPipe, EmptyComponent]
})
export class StudentTestsComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly tests = signal<AvailableTest[]>([]);
  readonly error = signal('');

  constructor() {
    this.api.get<AvailableTest[]>('/tests/available').subscribe({
      next: (rows) => this.tests.set(rows || []),
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  open(test: AvailableTest): void {
    if (test.attemptStatus === 'SUBMITTED' || test.attemptStatus === 'AUTO_SUBMITTED') {
      void this.router.navigate(['/tests', test.id, 'result']);
      return;
    }
    if (test.attemptStatus === 'IN_PROGRESS') {
      void this.router.navigate(['/tests', test.id, 'take']);
      return;
    }
    void this.router.navigate(['/tests', test.id, 'instructions']);
  }
}
