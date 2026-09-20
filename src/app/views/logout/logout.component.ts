import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { I18nService } from '../../core/i18n.service';

@Component({
  selector: 'app-logout',
  template: '',
  standalone: true
})
export class LogoutComponent {
  constructor() {
    const confirm = inject(ConfirmService);
    const auth = inject(AuthService);
    const router = inject(Router);
    const i18n = inject(I18nService);
    void confirm.ask(i18n.t('common.logoutConfirm'), i18n.t('nav.logout')).then((ok) => {
      if (ok) auth.logout();
      else void router.navigateByUrl('/dashboard');
    });
  }
}
