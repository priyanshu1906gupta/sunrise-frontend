import { Injectable, inject } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';
import { I18nService } from './i18n.service';

const TOAST = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2800,
  timerProgressBar: true
});

const MODAL = Swal.mixin({
  confirmButtonColor: '#2eb85c',
  cancelButtonColor: '#6c757d'
});

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly i18n = inject(I18nService);

  success(message: string): void {
    void TOAST.fire({ icon: 'success', title: message });
  }

  error(message: string): void {
    void TOAST.fire({ icon: 'error', title: message });
  }

  info(message: string): void {
    void TOAST.fire({ icon: 'info', title: message });
  }

  popup(message: string, icon: SweetAlertIcon = 'info', title?: string): void {
    void MODAL.fire({
      icon,
      title: title ?? this.i18n.t('common.confirm'),
      text: message
    });
  }

  sessionExpired(): void {
    void MODAL.fire({
      icon: 'warning',
      title: this.i18n.t('auth.sessionExpiredTitle'),
      text: this.i18n.t('auth.sessionExpired'),
      confirmButtonText: this.i18n.t('auth.loginBtn')
    });
  }
}
