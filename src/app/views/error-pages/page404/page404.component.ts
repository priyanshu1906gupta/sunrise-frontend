import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ColComponent, ContainerComponent, RowComponent } from '@coreui/angular';

@Component({
  selector: 'app-page404',
  templateUrl: './page404.component.html',
  imports: [ContainerComponent, RowComponent, ColComponent, ButtonDirective, RouterLink]
})
export class Page404Component {}
