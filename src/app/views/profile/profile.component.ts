import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import {
  ButtonDirective, CardBodyComponent, CardComponent, CardHeaderComponent, FormControlDirective, FormDirective, FormLabelDirective
} from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { TPipe } from '../../core/t.pipe';
import { I18nService } from '../../core/i18n.service';
import { AlertService } from '../../core/alert.service';
import { IconDirective } from '@coreui/icons-angular';
import { PhotoUploadComponent } from '../../shared/photo-upload.component';
import { PasswordInputComponent } from '../../shared/password-input.component';
import { FallbackSrcDirective } from '../../shared/fallback-src.directive';
import { PhotoPickerService } from '../../core/photo-picker.service';

const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

function matchNewPassword(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!next || !confirm) return null;
  return next === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  imports: [
    ReactiveFormsModule, ButtonDirective, CardComponent, CardBodyComponent, CardHeaderComponent, FormDirective, FormControlDirective,
    FormLabelDirective, TPipe, PhotoUploadComponent, IconDirective, PasswordInputComponent, FallbackSrcDirective
  ]
})
export class ProfileComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly alerts = inject(AlertService);
  private readonly fb = inject(FormBuilder);
  private readonly photos = inject(PhotoPickerService);
  readonly company = signal<Record<string, unknown> | null>(null);
  readonly editing = signal(false);
  readonly error = signal('');
  readonly passwordError = signal('');
  readonly passwordOk = signal('');
  readonly logoId = signal<string | null>(null);
  readonly imageIds = signal<string[]>([]);
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    ownerName: ['', Validators.required],
    email: ['', Validators.required],
    phone: ['', Validators.required],
    bio: ['']
  });
  readonly passwordForm = this.fb.nonNullable.group(
    {
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.pattern(PASSWORD)]],
      confirmPassword: ['', Validators.required]
    },
    { validators: matchNewPassword }
  );

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.get<Record<string, unknown>>('/company').subscribe({
      next: (c) => {
        this.company.set(c);
        this.form.patchValue({
          name: c['name'] as string,
          ownerName: c['ownerName'] as string,
          email: c['email'] as string,
          phone: c['phone'] as string,
          bio: (c['bio'] as string) || ''
        });
        this.logoId.set(this.photos.peekDraft('company-logo')?.id || (c['logoFileId'] as string) || null);
        const images = ((c['images'] as { fileId: string }[]) || []).map((i) => i.fileId);
        const extra = this.photos.peekDraft('company-photos');
        this.imageIds.set(extra?.id && !images.includes(extra.id) ? [...images, extra.id].slice(-3) : images);
        const restore = this.photos.takeRestore('profile');
        if (restore?.form) this.form.patchValue(restore.form as never);
        const extraIds = restore?.extra?.['imageIds'];
        if (typeof restore?.extra?.['logoId'] === 'string') this.logoId.set(restore.extra['logoId'] as string);
        if (Array.isArray(extraIds)) this.imageIds.set(extraIds as string[]);
        this.editing.set(Boolean(restore || this.photos.peekDraft('company-logo') || extra));
        if (this.editing()) this.photos.noteHost('profile', null);
      },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  startEdit(): void {
    this.editing.set(true);
    this.photos.noteHost('profile', null);
  }

  stashPhotoForm(): void {
    this.photos.stash(this.form.getRawValue(), { logoId: this.logoId(), imageIds: this.imageIds() });
  }

  save(): void {
    this.api.put('/company', {
      ...this.form.getRawValue(),
      logoFileId: this.logoId(),
      imageFileIds: this.imageIds()
    }).subscribe({
      next: () => {
        this.photos.clearDraft('company-logo');
        this.photos.clearDraft('company-photos');
        this.photos.clearSession();
        this.editing.set(false);
        this.alerts.success(this.i18n.t('common.saved'));
        this.auth.loadMe().subscribe({
          next: () => this.load(),
          error: () => this.load()
        });
      },
      error: (e) => {
        this.error.set(apiErrorMessage(e));
        this.alerts.error(apiErrorMessage(e));
      }
    });
  }

  savePassword(): void {
    this.passwordError.set('');
    this.passwordOk.set('');
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      if (this.passwordForm.hasError('mismatch')) {
        this.passwordError.set(this.i18n.t('profile.passwordMismatch'));
      }
      return;
    }
    const { oldPassword, newPassword } = this.passwordForm.getRawValue();
    this.auth.changePassword(oldPassword, newPassword).subscribe({
      next: () => {
        this.passwordOk.set(this.i18n.t('profile.passwordUpdated'));
        this.alerts.success(this.i18n.t('profile.passwordUpdated'));
        this.passwordForm.reset({ oldPassword: '', newPassword: '', confirmPassword: '' });
      },
      error: (e) => {
        this.passwordError.set(apiErrorMessage(e));
        this.alerts.error(apiErrorMessage(e));
      }
    });
  }
}
