import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonDirective, FormControlDirective, FormDirective, FormLabelDirective } from '@coreui/angular';
import { AuthService } from '../../../core/auth.service';
import { AlertService } from '../../../core/alert.service';
import { apiErrorMessage } from '../../../core/api.service';
import { I18nService } from '../../../core/i18n.service';
import { PasswordInputComponent } from '../../../shared/password-input.component';
import { TPipe } from '../../../core/t.pipe';
import { AuthShellComponent } from '../auth-shell.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  host: { class: 'ff-auth' },
  imports: [
    AuthShellComponent,
    ButtonDirective,
    FormControlDirective,
    FormDirective,
    FormLabelDirective,
    ReactiveFormsModule,
    RouterLink,
    TPipe,
    PasswordInputComponent
  ]
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    email: ['', Validators.required],
    password: ['', Validators.required]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () =>
        this.auth.loadMe().subscribe({
          next: () => {
            this.alerts.success(this.i18n.t('auth.loginSuccess'));
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
