import { Component, OnDestroy, inject, signal } from '@angular/core';
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

const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
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
export class ResetPasswordComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private timer?: ReturnType<typeof setInterval>;

  readonly step = signal<1 | 2 | 3>(1);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly seconds = signal(0);
  readonly Math = Math;
  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });
  readonly otpForm = this.fb.nonNullable.group({
    otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
  });
  readonly passwordForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(PASSWORD)]]
  });

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private normalizedEmail(): string {
    return this.emailForm.controls.email.value.trim().toLowerCase();
  }

  sendOtp(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      this.error.set(this.i18n.t('auth.emailInvalid'));
      return;
    }
    this.error.set('');
    this.busy.set(true);
    this.auth.forgotPassword(this.normalizedEmail()).subscribe({
      next: () => {
        this.busy.set(false);
        this.step.set(2);
        this.startTimer();
        this.alerts.success(this.i18n.t('auth.otpSent'));
      },
      error: (err) => this.fail(err)
    });
  }

  verify(): void {
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      this.error.set(this.i18n.t('auth.otpInvalid'));
      return;
    }
    this.busy.set(true);
    this.auth.verifyOtp(this.normalizedEmail(), this.otpForm.controls.otp.value.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.step.set(3);
      },
      error: (err) => this.fail(err)
    });
  }

  reset(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.error.set(this.i18n.t('auth.passwordHint'));
      return;
    }
    this.busy.set(true);
    this.auth.resetPassword(
      this.normalizedEmail(),
      this.otpForm.controls.otp.value.trim(),
      this.passwordForm.controls.password.value
    ).subscribe({
      next: () => {
        this.busy.set(false);
        this.alerts.success(this.i18n.t('auth.resetSuccess'));
        void this.router.navigateByUrl('/authentication/login');
      },
      error: (err) => this.fail(err)
    });
  }

  private startTimer(): void {
    this.seconds.set(300);
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const s = this.seconds() - 1;
      this.seconds.set(Math.max(0, s));
      if (s <= 0 && this.timer) clearInterval(this.timer);
    }, 1000);
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const message = apiErrorMessage(err);
    this.error.set(message);
    this.alerts.error(message);
  }
}
