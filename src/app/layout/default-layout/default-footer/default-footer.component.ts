import { Component } from '@angular/core';
import { FooterComponent } from '@coreui/angular';
import { TPipe } from '../../../core/t.pipe';

@Component({
  selector: 'app-default-footer',
  templateUrl: './default-footer.component.html',
  styleUrls: ['./default-footer.component.scss'],
  imports: [TPipe]
})
export class DefaultFooterComponent extends FooterComponent {
  constructor() {
    super();
  }
}
