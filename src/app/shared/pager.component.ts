import { Component, input, output } from '@angular/core';
import { PageItemDirective, PageLinkDirective, PaginationComponent } from '@coreui/angular';

@Component({
  selector: 'app-pager',
  standalone: true,
  imports: [PaginationComponent, PageItemDirective, PageLinkDirective],
  template: `
    @if (totalPages() > 1) {
      <c-pagination class="mt-3">
        <li cPageItem [disabled]="page() <= 1">
          <a cPageLink (click)="go(page() - 1)">Prev</a>
        </li>
        <li cPageItem>
          <span cPageLink>{{ page() }} / {{ totalPages() }}</span>
        </li>
        <li cPageItem [disabled]="page() >= totalPages()">
          <a cPageLink (click)="go(page() + 1)">Next</a>
        </li>
      </c-pagination>
    }
  `
})
export class PagerComponent {
  readonly page = input(1);
  readonly totalPages = input(0);
  readonly changed = output<number>();

  go(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.changed.emit(p);
  }
}
