import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonDirective,
  CardComponent,
  FormControlDirective,
  FormDirective,
  FormLabelDirective,
  TableDirective
} from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AlertService } from '../../core/alert.service';
import { toYmd } from '../../core/date';
import { I18nService } from '../../core/i18n.service';
import { TPipe } from '../../core/t.pipe';
import { EmptyComponent } from '../../shared/empty.component';

@Component({
  selector: 'app-leave',
  templateUrl: './leave.component.html',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    ButtonDirective,
    CardComponent,
    FormDirective,
    FormControlDirective,
    FormLabelDirective,
    TableDirective,
    TPipe,
    EmptyComponent
  ]
})
export class LeaveComponent {
  private readonly api = inject(ApiService);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(FormBuilder);

  readonly list = signal<any[]>([]);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    fromDate: [toYmd(new Date()), Validators.required],
    toDate: [toYmd(new Date()), Validators.required],
    reason: ['', Validators.required]
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.api.get<any[]>('/leaves').subscribe({
      next: (rows) => this.list.set(rows || []),
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  apply(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.api.post('/leaves', { fromDate: toYmd(v.fromDate), toDate: toYmd(v.toDate), reason: v.reason }).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('leave.applied'));
        this.form.reset({ fromDate: toYmd(new Date()), toDate: toYmd(new Date()), reason: '' });
        this.load();
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }
}
