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
      if ((event.target as HTMLElement | null)?.closest('.ff-app, .ff-auth, .ff-page-body, .study-viewer')) {
        event.preventDefault();
      }
    });
    document.addEventListener('copy', (event) => {
      if ((event.target as HTMLElement | null)?.closest('input, textarea')) return;
      event.preventDefault();
    });
    document.addEventListener('cut', (event) => {
      if ((event.target as HTMLElement | null)?.closest('input, textarea')) return;
      event.preventDefault();
    });
    document.addEventListener('dragstart', (event) => event.preventDefault());
    document.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === 's' || key === 'p' || key === 'u')) {
        event.preventDefault();
      }
      if (key === 'printscreen') event.preventDefault();
    });
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { environment } = await import('../../environments/environment');
      if (environment.pushNotifications === false) return;
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return;
      await PushNotifications.register();
      await PushNotifications.addListener('registration', (token) => {
        const platform = Capacitor.getPlatform() === 'ios' ? 'IOS' : 'ANDROID';
        this.api.post('/devices', { token: token.value, platform }).subscribe({ error: () => undefined });
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = (action.notification.data || {}) as {
          type?: string;
          liveSessionId?: string;
          studyMaterialId?: string;
          url?: string;
        };
        if (data.type === 'LIVE_CLASS') {
          const path = data.url || (data.liveSessionId ? `/live-classes/${data.liveSessionId}` : '/live-classes');
          window.location.hash = `#${path.startsWith('/') ? path : `/${path}`}`;
        } else if (data.type === 'STUDY_MATERIAL') {
          const path = data.url || (data.studyMaterialId ? `/study-materials/${data.studyMaterialId}/view` : '/study-materials');
          window.location.hash = `#${path.startsWith('/') ? path : `/${path}`}`;
        } else if (data.type === 'TEST') {
          window.location.hash = '#/tests';
        }
      });
    } catch {
      /* web / electron without Capacitor runtime */
    }
  }
}
