import { Component } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { TPipe } from '../core/t.pipe';

@Component({
  selector: 'app-lang-switch',
  standalone: true,
  imports: [TPipe],
  template: `
    <div class="ff-lang" role="group" [attr.aria-label]="'lang.en' | t">
      <span class="ff-lang__thumb" [class.ff-lang__thumb--hi]="i18n.lang() === 'hi'"></span>
      <button
        type="button"
        class="ff-lang__btn"
        [class.active]="i18n.lang() === 'en'"
        [attr.aria-pressed]="i18n.lang() === 'en'"
        (click)="i18n.setLang('en')"
      >
        {{ 'lang.en' | t }}
      </button>
      <button
        type="button"
        class="ff-lang__btn"
        [class.active]="i18n.lang() === 'hi'"
        [attr.aria-pressed]="i18n.lang() === 'hi'"
        (click)="i18n.setLang('hi')"
      >
        {{ 'lang.hi' | t }}
      </button>
    </div>
  `,
  styles: `
    .ff-lang {
      position: relative;
      display: inline-grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      min-width: 10.5rem;
      padding: 3px;
      border: 1px solid var(--cui-primary);
      border-radius: 999px;
      background: var(--cui-body-bg);
      isolation: isolate;
    }

    .ff-lang__thumb {
      position: absolute;
      top: 3px;
      bottom: 3px;
      left: 3px;
      width: calc(50% - 3px);
      border-radius: 999px;
      background: var(--cui-primary);
      box-shadow: 0 1px 4px color-mix(in srgb, var(--cui-primary) 40%, transparent);
      transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 0;
    }

    .ff-lang__thumb--hi {
      transform: translateX(100%);
    }

    .ff-lang__btn {
      position: relative;
      z-index: 1;
      border: 0;
      background: transparent;
      color: var(--cui-primary);
      font-size: 0.8rem;
      font-weight: 600;
      line-height: 1.2;
      padding: 0.28rem 0.75rem;
      border-radius: 999px;
      cursor: pointer;
      transition: color 0.22s ease;
    }

    .ff-lang__btn.active {
      color: #fff;
    }

    .ff-lang__btn:focus-visible {
      outline: 2px solid var(--cui-primary);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      .ff-lang__thumb,
      .ff-lang__btn {
        transition: none;
      }
    }

    :host-context(.header) .ff-lang {
      min-width: 9.25rem;
      height: 2rem;
      box-sizing: border-box;
    }

    :host-context(.header) .ff-lang__btn {
      font-size: 0.75rem;
      padding: 0.18rem 0.55rem;
    }

    :host-context(.ff-auth) .ff-lang {
      background: rgba(8, 12, 20, 0.55);
      border-color: rgba(255, 255, 255, 0.35);
      backdrop-filter: blur(10px);
    }

    :host-context(.ff-auth) .ff-lang__btn {
      color: rgba(255, 255, 255, 0.82);
    }
  `
})
export class LangSwitchComponent {
  constructor(readonly i18n: I18nService) {}
}
