import { AfterViewInit, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective, CardBodyComponent, CardComponent } from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AlertService } from '../../core/alert.service';
import { I18nService } from '../../core/i18n.service';
import { TPipe } from '../../core/t.pipe';
import { AvailableTest, negativeLabel } from './test.models';

@Component({
  selector: 'app-test-instructions',
  templateUrl: './test-instructions.component.html',
  styleUrl: './test-instructions.component.scss',
  imports: [FormsModule, ButtonDirective, CardComponent, CardBodyComponent, TPipe]
})
export class TestInstructionsComponent implements AfterViewInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);

  readonly test = signal<AvailableTest | null>(null);
  readonly lang = signal<'en' | 'hi'>(this.i18n.lang());
  readonly accepted = signal(false);
  readonly error = signal('');
  private readonly testId = this.route.snapshot.paramMap.get('id')!;

  constructor() {
    this.api.get<AvailableTest[]>('/tests/available').subscribe({
      next: (rows) => {
        const found = (rows || []).find((t) => t.id === this.testId) ?? null;
        this.test.set(found);
        if (!found) this.error.set(this.i18n.t('common.noData'));
      },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  ngAfterViewInit(): void {
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  negativeText(): string {
    const t = this.test();
    if (!t?.negativeEnabled) return this.i18n.t('tests.noNegative');
    return this.i18n.t('tests.negativeHelp').replace('{frac}', negativeLabel(t.negativeFraction));
  }

  start(): void {
    if (!this.accepted()) {
      this.alerts.error(this.i18n.t('tests.needAccept'));
      return;
    }
    void this.router.navigate(['/tests', this.testId, 'take']);
  }
}
