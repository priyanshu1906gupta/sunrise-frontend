import { ApplicationConfig, provideAppInitializer, inject } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
  withHashLocation,
  withInMemoryScrolling,
  withRouterConfig,
  withViewTransitions
} from '@angular/router';
import { IconSetService } from '@coreui/icons-angular';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { loaderInterceptor } from './core/loader.interceptor';
import { mediaUrlInterceptor } from './core/media-url.interceptor';
import { I18nService } from './core/i18n.service';
import { PhotoPickerService, installPhotoCameraGuards } from './core/photo-picker.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withRouterConfig({ onSameUrlNavigation: 'ignore' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      withEnabledBlockingInitialNavigation(),
      withViewTransitions(),
      withHashLocation()
    ),
    provideHttpClient(withInterceptors([authInterceptor, mediaUrlInterceptor, loaderInterceptor])),
    provideAppInitializer(() => {
      installPhotoCameraGuards();
      inject(PhotoPickerService);
      inject(I18nService).init();
    }),
    IconSetService,
    provideAnimationsAsync()
  ]
};
