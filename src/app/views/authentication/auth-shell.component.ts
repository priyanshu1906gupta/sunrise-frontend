import { Component, OnDestroy, OnInit, inject, input } from '@angular/core';
import { LangSwitchComponent } from '../../shared/lang-switch.component';
import { TPipe } from '../../core/t.pipe';
import { AuthBackgroundService } from './auth-background.service';

@Component({
  selector: 'app-auth-shell',
  imports: [LangSwitchComponent, TPipe],
  template: `
    <div class="ff-auth-bg" aria-hidden="true">
      @for (src of bg.images; track src; let i = $index) {
        <div
          class="ff-auth-slide"
          [class.is-active]="i === bg.index()"
          [style.background-image]="'url(' + src + ')'"
        ></div>
      }
      <div class="ff-auth-veil"></div>
    </div>
    <div class="ff-auth-lang">
      <app-lang-switch />
    </div>
    <div class="ff-auth-stage">
      <div class="ff-auth-panel" [class.is-wide]="wide()">
        <div class="ff-auth-brand">
          <img src="assets/brand/logo.png" alt="Fitness-Freaks" class="ff-logo-lg" />
          <h1 class="ff-auth-name">{{ 'app.name' | t }}</h1>
          <p class="ff-auth-tagline">{{ 'app.tagline' | t }}</p>
        </div>
        <ng-content />
      </div>
    </div>
  `
})
export class AuthShellComponent implements OnInit, OnDestroy {
  readonly bg = inject(AuthBackgroundService);
  readonly wide = input(false);

  ngOnInit(): void {
    this.bg.start();
  }

  ngOnDestroy(): void {
    this.bg.stop();
  }
}
