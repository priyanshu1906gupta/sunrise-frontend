import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.token()) {
    return router.createUrlTree(['/authentication/login']);
  }
  if (auth.isIdle()) {
    auth.expireSession();
    return false;
  }
  if (auth.me()) {
    return true;
  }
  return auth.loadMe().pipe(
    map(() => true),
  catchError(() => {
      if (auth.token()) auth.clearSession();
      return of(router.createUrlTree(['/authentication/login']));
    })
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.token() && auth.isIdle()) {
    auth.expireSession();
    return true;
  }
  if (auth.token()) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.me()?.role === 'ADMIN') {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};

export const writeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.me()?.role;
  if (role === 'ADMIN' || role === 'MANAGER') {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};

export const teacherGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.me()?.role === 'TEACHER') {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};

export const studentGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.me()?.role === 'STUDENT') {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};

export const testAuthorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.me()?.role;
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'TEACHER') {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};
