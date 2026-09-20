import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SpinnerComponent } from '@coreui/angular';
import { ColorModeService } from '@coreui/angular';
import { IconSetService } from '@coreui/icons-angular';
import { iconSubset } from './icons/icon-subset';
import { LoaderService } from './core/loader.service';
import { NativeShellService } from './core/native-shell.service';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  template: `
    @if (loader.active()) {
      <div class="ff-loader d-flex align-items-center justify-content-center">
        <c-spinner color="primary" />
      </div>
    }
    <router-outlet />
  `,
  imports: [RouterOutlet, SpinnerComponent]
})
export class AppComponent {
  title = 'Sunrise Coaching Khargone';
  readonly loader = inject(LoaderService);

  constructor() {
    const titleService = inject(Title);
    const icons = inject(IconSetService);
    const color = inject(ColorModeService);
    titleService.setTitle(this.title);
    icons.icons = { ...iconSubset };
    color.localStorageItemName.set('sunrise-theme');
    color.eventName.set('ColorSchemeChange');
    void inject(NativeShellService).start();
  }
}
