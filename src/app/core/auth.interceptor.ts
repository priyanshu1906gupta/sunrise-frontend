import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AlertService } from './alert.service';
import { apiErrorMessage } from './api.service';
import { AuthService } from './auth.service';

const AUTH_RETRY = new HttpContextToken(() => false);

function isPublicAuth(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/google') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/verify-otp') ||
    url.includes('/auth/reset-password') ||
    url.includes('/auth/logout') ||
    url.includes('/auth/config') ||
    url.includes('/super/')
  );
}

function isBackendApi(url: string): boolean {
  return url.includes('/api/');
}

function countsAsSessionActivity(url: string, method: string): boolean {
  if (!isBackendApi(url) || isPublicAuth(url)) return false;
  if (method.toUpperCase() === 'GET' && url.includes('/notifications')) return false;
  return true;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const alerts = inject(AlertService);
  const skipBearer = isPublicAuth(req.url);
  const token = auth.token();
  const backend = isBackendApi(req.url);

  if (token && !skipBearer && backend && auth.isIdle()) {
    auth.expireSession();
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 401,
          statusText: 'Session expired',
          url: req.url
        })
    );
  }

  if (token && countsAsSessionActivity(req.url, req.method)) {
    auth.touchActivity();
  }

  const cloned =
    token && !skipBearer ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(cloned).pipe(
    catchError((err: HttpErrorResponse) => {
      const code = (err.error as { code?: string } | undefined)?.code;
      if (
        err.status === 403 &&
        !skipBearer &&
        (code === 'ACCOUNT_DEACTIVATED' || code === 'SUBSCRIPTION_ENDED')
      ) {
        auth.logout({ silent: true });
        alerts.error(apiErrorMessage(err));
        return throwError(() => err);
      }
      if (err.status !== 401 || skipBearer || req.context.get(AUTH_RETRY)) {
        return throwError(() => err);
      }
      if (code === 'SESSION_EXPIRED' || auth.isIdle()) {
        auth.expireSession();
        return throwError(() => err);
      }
      return auth.refreshAccess().pipe(
        switchMap((res) =>
          next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${res.token}` },
              context: req.context.set(AUTH_RETRY, true)
            })
          )
        ),
        catchError((refreshErr) => {
          auth.expireSession();
          return throwError(() => refreshErr);
        })
      );
    })
  );
};
