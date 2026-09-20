import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ButtonDirective,
  ColComponent,
  FormControlDirective,
  FormDirective,
  FormLabelDirective,
  RowComponent
} from '@coreui/angular';
import { AuthService } from '../../../core/auth.service';
import { AlertService } from '../../../core/alert.service';
import { apiErrorMessage } from '../../../core/api.service';
import { I18nService } from '../../../core/i18n.service';
import { PasswordInputComponent } from '../../../shared/password-input.component';
import { TPipe } from '../../../core/t.pipe';
import { AuthShellComponent } from '../auth-shell.component';

const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  host: { class: 'ff-auth' },
  imports: [
    AuthShellComponent,
    ButtonDirective,
    ColComponent,
    FormControlDirective,
    FormDirective,
    FormLabelDirective,
    ReactiveFormsModule,
    RouterLink,
    RowComponent,
    TPipe,
    PasswordInputComponent
  ]
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly error = signal('');
  readonly courses = signal<{ id: string; name: string }[]>([]);
  readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    location: [''],
    courseId: [''],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(PASSWORD)]]
  });

  ngOnInit(): void {
    this.auth.config().subscribe({
      next: (c) => this.courses.set(c.courses || []),
      error: () => this.courses.set([])
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Please fill required fields. Password needs upper, lower, number and special character.');
      return;
    }
    this.error.set('');
    const body = { ...this.form.getRawValue() };
    if (!body.courseId) delete (body as { courseId?: string }).courseId;
    this.auth.register(body).subscribe({
      next: () =>
        this.auth.loadMe().subscribe({
          next: () => {
            this.alerts.success(this.i18n.t('auth.registerSuccess'));
            void this.router.navigateByUrl('/dashboard');
          },
          error: (err) => this.fail(err)
        }),
      error: (err) => this.fail(err)
    });
  }

  private fail(err: unknown): void {
    const message = apiErrorMessage(err);
    this.error.set(message);
    this.alerts.error(message);
  }
}
