import { AfterViewChecked, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';
import {
  ContainerComponent,
  ShadowOnScrollDirective,
  SidebarBrandComponent,
  SidebarComponent,
  SidebarFooterComponent,
  SidebarHeaderComponent,
  SidebarNavComponent,
  SidebarToggleDirective,
  SidebarTogglerDirective
} from '@coreui/angular';
import { DefaultFooterComponent, DefaultHeaderComponent } from './';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { buildNav } from '../../core/nav';
import { FallbackSrcDirective } from '../../shared/fallback-src.directive';

@Component({
  selector: 'app-dashboard',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
    SidebarComponent,
    SidebarHeaderComponent,
    SidebarBrandComponent,
    SidebarNavComponent,
    SidebarFooterComponent,
    SidebarToggleDirective,
    SidebarTogglerDirective,
    ContainerComponent,
    DefaultFooterComponent,
    DefaultHeaderComponent,
    NgScrollbar,
    RouterOutlet,
    RouterLink,
    ShadowOnScrollDirective,
    FallbackSrcDirective
  ]
})
export class DefaultLayoutComponent implements AfterViewChecked {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private navStamp = '';

  readonly navItems = computed(() => {
    this.i18n.lang();
    this.i18n.dict();
    return buildNav(this.auth.me(), this.i18n);
  });

  ngAfterViewChecked(): void {
    const stamp = `${this.i18n.lang()}-${this.auth.branches().map((b) => b.id).join(',')}-${this.router.url}`;
    if (stamp === this.navStamp) return;
    const hasGroups = this.navItems().some((item) => !!item.children?.length);
    if (!hasGroups) {
      this.navStamp = stamp;
      return;
    }
    const first = document.querySelector('#sidebar1 .sidebar-nav:not(.nav-group-items) > .nav-group');
    if (!first) return;
    this.navStamp = stamp;
    if (!first.classList.contains('show')) {
      (first.querySelector('.nav-group-toggle') as HTMLElement | null)?.click();
    }
  }
}
