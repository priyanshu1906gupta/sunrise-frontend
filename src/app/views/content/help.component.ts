import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  FormControlDirective,
  FormDirective,
  FormLabelDirective
} from '@coreui/angular';
import { AlertService } from '../../core/alert.service';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import { TPipe } from '../../core/t.pipe';

@Component({
  selector: 'app-help',
  template: `
    <h2 class="h4 ff-toolbar mb-3">{{ data()?.title || ('nav.help' | t) }}</h2>
    <c-card class="mb-3">
      <c-card-body>
        @if (data(); as d) {
          <p>{{ d.body }}</p>
          <p class="fw-semibold mb-1">{{ 'help.contact' | t }}</p>
          <p class="mb-1">{{ 'auth.email' | t }}: {{ d.email }}</p>
          <p class="mb-0">{{ 'auth.mobile' | t }}: {{ d.phone }}</p>
        }
      </c-card-body>
    </c-card>
    <c-card>
      <c-card-body>
        <h3 class="h5 mb-3">{{ 'help.sendQuery' | t }}</h3>
        <form cForm [formGroup]="form" (ngSubmit)="send()">
          <label cLabel>{{ 'help.title' | t }}</label>
          <input cFormControl formControlName="title" class="mb-2" />
          @if (form.controls.title.touched && form.controls.title.invalid) {
            <div class="text-danger small mb-2">{{ 'help.required' | t }}</div>
          }
          <label cLabel>{{ 'help.description' | t }}</label>
          <textarea cFormControl formControlName="description" rows="5" class="mb-2"></textarea>
          @if (form.controls.description.touched && form.controls.description.invalid) {
            <div class="text-danger small mb-2">{{ 'help.required' | t }}</div>
          }
          <button cButton color="primary" type="submit" [disabled]="busy()">
            {{ busy() ? ('auth.sending' | t) : ('help.send' | t) }}
          </button>
        </form>
      </c-card-body>
    </c-card>
  `,
  imports: [
    CardComponent,
    CardBodyComponent,
    TPipe,
    ReactiveFormsModule,
    FormDirective,
    FormControlDirective,
    FormLabelDirective,
    ButtonDirective
  ]
})
export class HelpComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);
  readonly data = signal<{ title: string; body: string; email: string; phone: string } | null>(null);
  readonly busy = signal(false);
  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required]
  });

  ngOnInit(): void {
    this.api.get<{ title: string; body: string; email: string; phone: string }>('/content/help').subscribe({
      next: (d) => this.data.set(d),
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  send(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    const v = this.form.getRawValue();
    this.api.post('/content/help/query', v).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.reset({ title: '', description: '' });
        this.alerts.success(this.i18n.t('help.sent'));
      },
      error: (e) => {
        this.busy.set(false);
        this.alerts.error(apiErrorMessage(e));
      }
    });
  }
}
