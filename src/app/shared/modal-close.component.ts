import { Component, output } from '@angular/core';
import { ButtonCloseDirective } from '@coreui/angular';

@Component({
  selector: 'app-modal-close',
  standalone: true,
  imports: [ButtonCloseDirective],
  host: { class: 'ms-auto' },
  template: `<button type="button" class="btn-close" cButtonClose (click)="closed.emit()" aria-label="Close"></button>`,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: 0 0 auto;
        margin-inline-start: auto;
      }
    `
  ]
})
export class ModalCloseComponent {
  readonly closed = output();
}
