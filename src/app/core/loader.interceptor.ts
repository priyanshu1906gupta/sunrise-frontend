import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoaderService } from './loader.service';
import { PhotoPickerService } from './photo-picker.service';

export const loaderInterceptor: HttpInterceptorFn = (req, next) => {
  const picker = inject(PhotoPickerService);
  if (req.url.includes('/assets/i18n/') || req.url.includes('/files') || req.url.includes('/auth/refresh') || req.url.includes('/notifications') || picker.isBusy()) {
    return next(req);
  }
  const loader = inject(LoaderService);
  loader.begin();
  return next(req).pipe(finalize(() => loader.end()));
};
