import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  FormControlDirective,
  FormLabelDirective,
  TableDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import * as XLSX from 'xlsx';
import { AlertService } from '../../core/alert.service';
import { ApiService, apiErrorMessage, triggerBrowserDownload } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { TPipe } from '../../core/t.pipe';
import { NegativeFraction, TestQuestionPreview, emptyPreviewRow, previewToQuestion } from './test.models';

type CourseOpt = { id: string; name: string };

@Component({
  selector: 'app-tests-create',
  templateUrl: './tests-create.component.html',
  imports: [
    FormsModule,
    ButtonDirective,
    CardComponent,
    CardBodyComponent,
    FormControlDirective,
    FormLabelDirective,
    TableDirective,
    IconDirective,
    RouterLink,
    TPipe
  ]
})
export class TestsCreateComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);

  readonly courses = signal<CourseOpt[]>([]);
  readonly rows = signal<TestQuestionPreview[]>([]);
  readonly busy = signal(false);
  readonly name = signal('');
  readonly courseId = signal('');
  readonly durationMinutes = signal(60);
  readonly questionCount = signal(0);
  readonly negativeEnabled = signal(false);
  readonly negativeFraction = signal<NegativeFraction>('HALF');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  get backLink(): string[] {
    const id = this.route.snapshot.paramMap.get('branchId');
    return id ? ['/branches', id, 'add-tests'] : ['/add-tests'];
  }

  get branchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || this.auth.branches()[0]?.id;
  }

  constructor() {
    this.api.get<CourseOpt[]>('/courses', { branchId: this.branchId }).subscribe({
      next: (rows) => this.courses.set(rows || []),
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  downloadSample(): void {
    this.api.download('/tests/sample.xlsx').subscribe({
      next: (blob) => triggerBrowserDownload(blob, 'test-questions-sample.xlsx'),
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, unknown>[];
        const mapped = json.map((row) => this.mapRow(row)).filter((r) => r.questionEn || r.questionHi);
        this.rows.set(mapped);
        if (mapped.length) this.questionCount.set(mapped.length);
      } catch {
        this.alerts.error(this.i18n.t('tests.parseError'));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  removeRow(index: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateRow(index: number, field: keyof TestQuestionPreview, value: string | number): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  submit(): void {
    if (!this.name().trim() || !this.courseId()) {
      this.alerts.error(this.i18n.t('tests.needCourse'));
      return;
    }
    if (!this.rows().length) {
      this.alerts.error(this.i18n.t('tests.needQuestions'));
      return;
    }
    this.busy.set(true);
    this.api
      .post<{ id: string }>('/tests', {
        name: this.name().trim(),
        courseId: this.courseId(),
        durationMinutes: Number(this.durationMinutes()) || 1,
        questionCount: Number(this.questionCount()) || this.rows().length,
        negativeEnabled: this.negativeEnabled(),
        negativeFraction: this.negativeEnabled() ? this.negativeFraction() : null,
        branchId: this.branchId,
        questions: this.rows().map(previewToQuestion)
      })
      .subscribe({
        next: (created) => {
          this.busy.set(false);
          this.alerts.success(this.i18n.t('tests.created'));
          const branch = this.route.snapshot.paramMap.get('branchId');
          void this.router.navigate(branch ? ['/branches', branch, 'add-tests', created.id] : ['/add-tests', created.id]);
        },
        error: (e) => {
          this.busy.set(false);
          this.alerts.error(apiErrorMessage(e));
        }
      });
  }

  private mapRow(row: Record<string, unknown>): TestQuestionPreview {
    const get = (...keys: string[]) => {
      const found = Object.entries(row).find(([key]) => keys.includes(key.trim().toLowerCase()));
      return found ? String(found[1] ?? '').trim() : '';
    };
    const out = emptyPreviewRow();
    out.subjectName = get('subject');
    out.questionEn = get('question en', 'question in english', 'question english');
    out.questionHi = get('question hi', 'question in hindi', 'question hindi');
    out.correctIndex = Number(get('answer number', 'answer', 'correct')) || 1;
    out.answerDescription = get('answer description', 'description');
    for (let n = 1; n <= 6; n++) {
      const en = get(`option ${n} en`, `option ${n} in english`, `option${n} en`);
      const hi = get(`option ${n} hi`, `option ${n} in hindi`, `option${n} hi`);
      (out as unknown as Record<string, string>)[`opt${n}en`] = en;
      (out as unknown as Record<string, string>)[`opt${n}hi`] = hi;
    }
    return out;
  }
}
