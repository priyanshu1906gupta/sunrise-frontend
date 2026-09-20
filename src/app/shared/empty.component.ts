import { Component, input } from '@angular/core';
import { TPipe } from '../core/t.pipe';

@Component({
  selector: 'app-empty',
  standalone: true,
  imports: [TPipe],
  template: `
    <div class="ff-empty">
      <div class="ff-empty-mark" aria-hidden="true">∅</div>
      <div class="ff-empty-title">{{ 'common.noData' | t }}</div>
    </div>
  `
})
export class EmptyComponent {
  readonly show = input(true);
}
