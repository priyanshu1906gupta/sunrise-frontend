import { Component, inject } from '@angular/core';
import {
  ButtonDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective
} from '@coreui/angular';
import { ConfirmService } from '../core/confirm.service';
import { TPipe } from '../core/t.pipe';
import { ModalCloseComponent } from './modal-close.component';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ButtonDirective,
    TPipe,
    ModalCloseComponent
  ],
  template: `
    <c-modal [visible]="confirm.visible()" (visibleChange)="onVisible($event)" alignment="center">
      <c-modal-header>
        <h5 cModalTitle>{{ 'common.confirm' | t }}</h5>
        <app-modal-close (closed)="confirm.no()" />
      </c-modal-header>
      <c-modal-body>{{ confirm.message() }}</c-modal-body>
      <c-modal-footer>
        <button cButton color="secondary" (click)="confirm.no()">{{ 'common.no' | t }}</button>
        <button cButton color="danger" (click)="confirm.yes()">{{ 'common.yes' | t }}</button>
      </c-modal-footer>
    </c-modal>
  `
})
export class ConfirmModalComponent {
  readonly confirm = inject(ConfirmService);

  onVisible(v: boolean): void {
    if (!v) this.confirm.no();
  }
}
