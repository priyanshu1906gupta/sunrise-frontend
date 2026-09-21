import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class NativeShellService {
  private readonly api = inject(ApiService);
  private started = false;

  async start(): Promise<void> {
    if (this.started || typeof document === 'undefined') return;
    this.started = true;
    document.addEventListener('contextmenu', (event) => {
      if ((event.target as HTMLElement | null)?.closest('.ff-app, .ff-auth, .ff-page-body')) {
        event.preventDefault();
      }
    });
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return;
      await PushNotifications.register();
      await PushNotifications.addListener('registration', (token) => {
        const platform = Capacitor.getPlatform() === 'ios' ? 'IOS' : 'ANDROID';
        this.api.post('/devices', { token: token.value, platform }).subscribe({ error: () => undefined });
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = (action.notification.data || {}) as { type?: string; liveSessionId?: string; url?: string };
        if (data.type === 'LIVE_CLASS') {
          const path = data.url || (data.liveSessionId ? `/live-classes/${data.liveSessionId}` : '/live-classes');
          window.location.hash = `#${path.startsWith('/') ? path : `/${path}`}`;
        }
      });
    } catch {
      /* web / electron without Capacitor runtime */
    }
  }
}
