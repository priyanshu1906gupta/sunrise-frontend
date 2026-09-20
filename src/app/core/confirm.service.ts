import { Injectable, inject } from '@angular/core';
import Swal from 'sweetalert2';
import { I18nService } from './i18n.service';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly i18n = inject(I18nService);

  async ask(message: string, title?: string): Promise<boolean> {
    const result = await Swal.fire({
      icon: 'warning',
      title: title ?? this.i18n.t('common.confirm'),
      text: message,
      showCancelButton: true,
      confirmButtonColor: '#2eb85c',
      cancelButtonColor: '#6c757d',
      confirmButtonText: this.i18n.t('common.yes'),
      cancelButtonText: this.i18n.t('common.no'),
      reverseButtons: true
    });
    return result.isConfirmed;
  }
}
