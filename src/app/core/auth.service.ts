import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, shareReplay, tap, throwError } from 'rxjs';
import { AlertService } from './alert.service';
import { ApiService } from './api.service';
import { I18nService } from './i18n.service';
import { AuthUser, Me } from './models';

const TOKEN_KEY = 'sunrise_token';
const REFRESH_KEY = 'sunrise_refresh';
const ACTIVITY_KEY = 'sunrise_last_activity';
const DEFAULT_IDLE_MS = 6 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);

  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly me = signal<Me | null>(null);
  readonly logoVersion = signal(0);
  private idleMs = DEFAULT_IDLE_MS;
  private idleTimer?: ReturnType<typeof setInterval>;
  private refresh$?: Observable<{ token: string; refreshToken: string }>;
  private expiring = false;

  private readonly onVisibility = (): void => {
    if (document.visibilityState !== 'visible') return;
    if (this.token() && this.isIdle()) this.expireSession();
  };

  private readonly onStorage = (e: StorageEvent): void => {
    if (e.key !== TOKEN_KEY || e.newValue) return;
    if (!this.token()) return;
    this.clearSession();
    void this.router.navigateByUrl('/authentication/login');
  };

  readonly isAdmin = computed(() => this.me()?.role === 'ADMIN');
  readonly isTeacher = computed(() => this.me()?.role === 'TEACHER');
  readonly isStudent = computed(() => this.me()?.role === 'STUDENT');
  readonly canWrite = computed(() => this.me()?.role === 'ADMIN' || this.me()?.role === 'MANAGER');
  readonly canAuthorTests = computed(
    () => this.me()?.role === 'ADMIN' || this.me()?.role === 'MANAGER' || this.me()?.role === 'TEACHER'
  );
  readonly isMultiBranch = computed(() => (this.me()?.company.branchCount ?? 0) > 1);
  readonly branches = computed(() => this.me()?.branches ?? []);
  readonly brandLogo = computed(() => {
    const url = this.me()?.company?.logoUrl;
    if (!url) return 'assets/brand/logo.png';
    const v = this.logoVersion();
    return `${url}${url.includes('?') ? '&' : '?'}v=${v}`;
  });

  constructor() {
    if (this.token()) {
      queueMicrotask(() => this.config().subscribe({ error: () => undefined }));
      this.startIdleWatch();
    }
  }

  login(email: string, password: string) {
    return this.api
      .post<{ token: string; refreshToken: string; user: AuthUser }>('/auth/login', { email, password })
      .pipe(tap((res) => this.setSession(res.token, res.refreshToken)));
  }

  register(body: Record<string, unknown>) {
    return this.api.post<{ pendingActivation?: boolean; token?: string; refreshToken?: string; user?: AuthUser }>(
      '/auth/register',
      body
    );
  }

  google(_idToken: string) {
    return throwError(() => new Error('Google sign-in is disabled'));
  }

  loadMe() {
    return this.api.get<Me>('/auth/me').pipe(
      tap((me) => {
        this.me.set(me);
        this.logoVersion.update((n) => n + 1);
      })
    );
  }

  forgotPassword(email: string) {
    return this.api.post('/auth/forgot-password', { email });
  }

  verifyOtp(email: string, otp: string) {
    return this.api.post('/auth/verify-otp', { email, otp });
  }

  resetPassword(email: string, otp: string, password: string) {
    return this.api.post('/auth/reset-password', { email, otp, password });
  }

  changePassword(oldPassword: string, newPassword: string) {
    return this.api.put('/auth/change-password', { oldPassword, newPassword });
  }

  config() {
    return this.api
      .get<{
        googleClientId: string | null;
        idleTimeoutMs?: number;
        courses?: { id: string; name: string }[];
        logoUrl?: string | null;
        loginImages?: string[];
      }>('/auth/config')
      .pipe(
      tap((c) => {
        if (c.idleTimeoutMs && c.idleTimeoutMs > 0) this.idleMs = c.idleTimeoutMs;
      })
    );
  }

  refreshAccess(): Observable<{ token: string; refreshToken: string }> {
    if (this.refresh$) return this.refresh$;
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }
    this.refresh$ = this.api.post<{ token: string; refreshToken: string }>('/auth/refresh', { refreshToken }).pipe(
      tap((res) => this.setSession(res.token, res.refreshToken, { markActive: false })),
      finalize(() => {
        this.refresh$ = undefined;
      }),
      shareReplay(1)
    );
    return this.refresh$;
  }

  setSession(token: string, refreshToken?: string, opts?: { markActive?: boolean }): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.token.set(token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    if (opts?.markActive !== false) this.touchActivity();
    this.startIdleWatch();
  }

  applyGoogleToken(token: string, refreshToken?: string): void {
    this.setSession(token, refreshToken);
  }

  isIdle(): boolean {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) > this.idleMs;
  }

  touchActivity(): void {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    this.token.set(null);
    this.me.set(null);
    this.logoVersion.set(0);
    this.stopIdleWatch();
  }

  logout(opts?: { silent?: boolean; expired?: boolean }): void {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      this.api.post('/auth/logout', { refreshToken }).subscribe({ error: () => undefined });
    }
    this.clearSession();
    void this.router.navigateByUrl('/authentication/login');
    if (opts?.expired) {
      this.alerts.sessionExpired();
    } else if (!opts?.silent) {
      this.alerts.success(this.i18n.t('auth.logoutSuccess'));
    }
  }

  expireSession(): void {
    if (this.expiring || !this.token()) return;
    this.expiring = true;
    this.logout({ expired: true });
    this.expiring = false;
  }

  private startIdleWatch(): void {
    this.stopIdleWatch();
    if (!localStorage.getItem(ACTIVITY_KEY)) this.touchActivity();
    if (this.isIdle()) {
      queueMicrotask(() => this.expireSession());
      return;
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('storage', this.onStorage);
    this.idleTimer = setInterval(() => {
      if (this.token() && this.isIdle()) this.expireSession();
    }, 15_000);
  }

  private stopIdleWatch(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = undefined;
    }
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('storage', this.onStorage);
  }
}
