import { AfterViewChecked, Component, computed, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';
import {
  ContainerComponent,
  INavData,
  ShadowOnScrollDirective,
  SidebarBrandComponent,
  SidebarComponent,
  SidebarFooterComponent,
  SidebarHeaderComponent,
  SidebarNavComponent,
  SidebarService,
  SidebarToggleDirective,
  SidebarTogglerDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { filter } from 'rxjs';
import { DefaultFooterComponent, DefaultHeaderComponent } from './';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { buildNav } from '../../core/nav';
import { FallbackSrcDirective } from '../../shared/fallback-src.directive';

function navIconName(item: INavData): string {
  const raw = item.iconComponent?.name || (typeof item.icon === 'string' ? item.icon : '') || 'cil-puzzle';
  return raw.replace(/-([a-z])/g, (_m: string, c: string) => c.toUpperCase());
}

function flattenNav(items: INavData[], prefix = ''): { name: string; url: string; icon: string }[] {
  const out: { name: string; url: string; icon: string }[] = [];
  for (const item of items) {
    if (item.title) continue;
    const label = prefix && item.name ? `${prefix} · ${item.name}` : item.name || '';
    if (item.children?.length) {
      out.push(...flattenNav(item.children, item.name || prefix));
      continue;
    }
    if (typeof item.url === 'string' && item.url) {
      out.push({ name: label, url: item.url, icon: navIconName(item) });
    }
  }
  return out;
}

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
    FallbackSrcDirective,
    IconDirective
  ]
})
export class DefaultLayoutComponent implements AfterViewChecked {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly sidebarService = inject(SidebarService);
  private readonly sidebar = viewChild<SidebarComponent>('sidebar1');
  private navStamp = '';
  readonly sidebarVisible = signal(typeof window === 'undefined' || window.innerWidth >= 992);

  readonly navItems = computed(() => {
    this.i18n.lang();
    this.i18n.dict();
    return buildNav(this.auth.me(), this.i18n);
  });

  readonly gridNavItems = computed(() => flattenNav(this.navItems()));

  constructor() {
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
      this.closeMobileSidebar();
    });
  }

  closeMobileSidebar(ev?: Event): void {
    ev?.stopPropagation();
    if (typeof window !== 'undefined' && window.innerWidth >= 992) return;
    this.sidebarVisible.set(false);
    const bar = this.sidebar();
    if (bar) {
      bar.visible = false;
      bar.sidebarState = { visible: false, sidebar: bar };
    }
    this.sidebarService.toggle({ visible: false, id: 'sidebar1' });
  }

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
