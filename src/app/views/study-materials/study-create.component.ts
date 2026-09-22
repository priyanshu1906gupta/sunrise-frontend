import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  FormControlDirective,
  FormLabelDirective
} from '@coreui/angular';
import { AlertService } from '../../core/alert.service';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { TPipe } from '../../core/t.pipe';

type CourseOpt = { id: string; name: string; subjects?: { id: string; name: string }[] };

@Component({
  selector: 'app-study-create',
  templateUrl: './study-create.component.html',
  imports: [FormsModule, ButtonDirective, CardComponent, CardBodyComponent, FormControlDirective, FormLabelDirective, RouterLink, TPipe]
})
export class StudyCreateComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);

  readonly courses = signal<CourseOpt[]>([]);
  readonly name = signal('');
  readonly courseId = signal('');
  readonly subjectId = signal('');
  readonly fileId = signal<string | null>(null);
  readonly fileName = signal('');
  readonly busy = signal(false);

  readonly subjects = computed(() => {
    const course = this.courses().find((c) => c.id === this.courseId());
    return course?.subjects ?? [];
  });

  get backLink(): string[] {
    const id = this.route.snapshot.paramMap.get('branchId');
    return id ? ['/branches', id, 'study-materials'] : ['/study-materials'];
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

  onCourseChange(value: string): void {
    this.courseId.set(value);
    this.subjectId.set('');
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.alerts.error(this.i18n.t('study.pdfOnly'));
      input.value = '';
      return;
    }
    this.busy.set(true);
    this.api.upload<{ id: string; originalName: string }>('/files/pdf', file).subscribe({
      next: (res) => {
        this.fileId.set(res.id);
        this.fileName.set(res.originalName || file.name);
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        this.alerts.error(apiErrorMessage(e));
        input.value = '';
      }
    });
  }

  save(): void {
    if (!this.courseId() || !this.subjectId() || !this.name().trim() || !this.fileId()) {
      this.alerts.error(this.i18n.t('study.needAll'));
      return;
    }
    this.busy.set(true);
    this.api
      .post('/study-materials', {
        branchId: this.branchId,
        courseId: this.courseId(),
        subjectId: this.subjectId(),
        name: this.name().trim(),
        fileId: this.fileId()
      })
      .subscribe({
        next: () => {
          this.alerts.success(this.i18n.t('study.saved'));
          void this.router.navigate(this.backLink);
        },
        error: (e) => {
          this.busy.set(false);
          this.alerts.error(apiErrorMessage(e));
        }
      });
  }
}
