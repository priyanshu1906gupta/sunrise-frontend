import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';
import { rewriteAssetUrlsInJson } from './media-url';

export const mediaUrlInterceptor: HttpInterceptorFn = (_req, next) => {
  return next(_req).pipe(
    map((event) => {
      if (!(event instanceof HttpResponse) || event.body == null) return event;
      if (typeof event.body !== 'object' || event.body instanceof Blob) return event;
      return event.clone({ body: rewriteAssetUrlsInJson(event.body) });
    })
  );
};
