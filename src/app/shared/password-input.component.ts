import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-password-input',
  standalone: true,
  host: { class: 'd-block' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordInputComponent),
      multi: true
    }
  ],
  template: `
    <div class="ff-pw-wrap">
      <input
        class="form-control pe-5"
        [id]="inputId()"
        [type]="visible() ? 'text' : 'password'"
        [value]="value()"
        [disabled]="disabled"
        [attr.autocomplete]="autocomplete()"
        [placeholder]="placeholder()"
        (input)="onInput($event)"
        (blur)="onTouched()"
      />
      <button
        type="button"
        class="ff-pw-toggle"
        [class.is-visible]="visible()"
        [attr.aria-label]="visible() ? 'Hide password' : 'Show password'"
        [attr.aria-pressed]="visible()"
        (click)="visible.set(!visible())"
      >
        @if (visible()) {
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M432 448a15.92 15.92 0 0 1-11.31-4.69l-352-352a16 16 0 0 1 22.62-22.62l352 352A16 16 0 0 1 432 448z"/>
            <path d="M255.66 384c-41.49 0-81.66-12.28-118.91-35.37-34.83-21.57-63.3-51.92-84.59-90.23a8 8 0 0 1 0-7.8c21.29-38.31 49.76-68.66 84.59-90.23 9.06-5.61 18.47-10.4 28.14-14.35L128.5 108.9C98.8 126 71.93 149.7 49 188.2a40.12 40.12 0 0 0 0 39.6c26.92 48.64 66.71 89.31 115.3 117.93C200.48 366.61 227.57 376 255.66 376c12.14 0 24.13-1.72 35.73-5.11l-24.38-24.38A79.2 79.2 0 0 1 255.66 384zm0-256c41.49 0 81.66 12.28 118.91 35.37 34.83 21.57 63.3 51.92 84.59 90.23a8 8 0 0 1 0 7.8c-9.11 16.4-19.43 31.16-30.77 44.19l22.82 22.82c16.81-17.31 32.38-37.41 46.13-62.19a40.12 40.12 0 0 0 0-39.6C471.08 177.56 431.29 136.89 382.7 108.27 335.54 81.39 296.66 72 255.66 72c-19.38 0-38.5 2.6-56.85 7.68l27.66 27.66A142 142 0 0 1 255.66 128z"/>
            <path d="M256 160a96 96 0 0 0-96 96 94.4 94.4 0 0 0 6.2 33.8l27-27A63.2 63.2 0 0 1 192 256a64 64 0 0 1 64-64 63.2 63.2 0 0 1 18.8 2.8l27-27A94.4 94.4 0 0 0 256 160z"/>
          </svg>
        } @else {
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M255.66 112c-77.94 0-157.89 45.47-220.83 135.33a35.76 35.76 0 0 0 0 37.34C97.77 354.53 177.72 400 255.66 400s157.89-45.47 220.83-135.33a35.76 35.76 0 0 0 0-37.34C413.55 157.47 333.6 112 255.66 112zm0 233.34A90.67 90.67 0 1 1 346.33 256a90.71 90.71 0 0 1-90.67 89.34z"/>
            <circle cx="256" cy="256" r="48"/>
          </svg>
        }
      </button>
    </div>
  `
})
export class PasswordInputComponent implements ControlValueAccessor {
  readonly inputId = input('');
  readonly autocomplete = input('current-password');
  readonly placeholder = input('');

  readonly visible = signal(false);
  readonly value = signal('');
  disabled = false;
  onChange: (v: string) => void = () => undefined;
  onTouched: () => void = () => undefined;

  writeValue(v: string | null): void {
    this.value.set(v ?? '');
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(ev: Event): void {
    const next = (ev.target as HTMLInputElement).value;
    this.value.set(next);
    this.onChange(next);
  }
}
