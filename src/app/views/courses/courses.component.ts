import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  FormControlDirective,
  FormDirective,
  FormLabelDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  RowComponent
} from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { AlertService } from '../../core/alert.service';
import { I18nService } from '../../core/i18n.service';
import { InrPipe } from '../../core/inr.pipe';
import { onBranchRouteChange } from '../../core/on-branch-route';
import { TPipe } from '../../core/t.pipe';
import { IconDirective } from '@coreui/icons-angular';
import { ModalCloseComponent } from '../../shared/modal-close.component';
import { EmptyComponent } from '../../shared/empty.component';

type SubjectRow = { id: string; name: string };
type CourseRow = {
  id: string;
  name: string;
  details?: string | null;
  durationMonths: number;
  price: number;
  subjects: SubjectRow[];
};

@Component({
  selector: 'app-courses',
  templateUrl: './courses.component.html',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    CardComponent,
    CardBodyComponent,
    ColComponent,
    RowComponent,
    FormDirective,
    FormControlDirective,
    FormLabelDirective,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    InrPipe,
    TPipe,
    EmptyComponent,
    IconDirective,
    ModalCloseComponent
  ]
})
export class CoursesComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);

  readonly courses = signal<CourseRow[]>([]);
  readonly subjects = signal<SubjectRow[]>([]);
  readonly error = signal('');
  readonly courseOpen = signal(false);
  readonly subjectOpen = signal(false);
  readonly editingCourseId = signal<string | null>(null);
  readonly editingSubjectId = signal<string | null>(null);
  readonly selectedSubjectIds = signal<string[]>([]);

  readonly courseForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    details: [''],
    durationMonths: [12, [Validators.required, Validators.min(1)]],
    price: [0, [Validators.required, Validators.min(0)]]
  });

  readonly subjectForm = this.fb.nonNullable.group({
    name: ['', Validators.required]
  });

  get branchId(): string | undefined {
    return this.route.snapshot.paramMap.get('branchId') || this.auth.branches()[0]?.id;
  }

  constructor() {
    onBranchRouteChange(() => this.load());
  }

  load(): void {
    this.api.get<CourseRow[]>('/courses', { branchId: this.branchId }).subscribe({
      next: (rows) => this.courses.set(rows || []),
      error: (e) => this.error.set(apiErrorMessage(e))
    });
    this.api.get<{ subjects: SubjectRow[] }>('/catalogs').subscribe({
      next: (d) => this.subjects.set(d.subjects || []),
      error: () => this.subjects.set([])
    });
  }

  toggleSubject(id: string): void {
    const cur = this.selectedSubjectIds();
    this.selectedSubjectIds.set(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  openCourse(item?: CourseRow): void {
    this.editingCourseId.set(item?.id ?? null);
    this.courseForm.reset({
      name: item?.name || '',
      details: item?.details || '',
      durationMonths: item?.durationMonths || 12,
      price: Number(item?.price || 0)
    });
    this.selectedSubjectIds.set((item?.subjects || []).map((s) => s.id));
    this.courseOpen.set(true);
  }

  saveCourse(): void {
    if (this.courseForm.invalid) {
      this.courseForm.markAllAsTouched();
      return;
    }
    const v = this.courseForm.getRawValue();
    const body = {
      name: v.name,
      details: v.details || null,
      durationMonths: Number(v.durationMonths),
      price: Number(v.price),
      subjectIds: this.selectedSubjectIds(),
      branchId: this.branchId
    };
    const req = this.editingCourseId()
      ? this.api.put(`/courses/${this.editingCourseId()}`, body)
      : this.api.post('/courses', body);
    req.subscribe({
      next: () => {
        this.courseOpen.set(false);
        this.alerts.success(this.i18n.t('common.saved'));
        this.load();
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  async removeCourse(id: string): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('common.deleteConfirm')))) return;
    this.api.delete(`/courses/${id}`).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('common.deleted'));
        this.load();
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  openSubject(item?: SubjectRow): void {
    this.editingSubjectId.set(item?.id ?? null);
    this.subjectForm.reset({ name: item?.name || '' });
    this.subjectOpen.set(true);
  }

  saveSubject(): void {
    if (this.subjectForm.invalid) {
      this.subjectForm.markAllAsTouched();
      return;
    }
    const name = this.subjectForm.controls.name.value;
    const req = this.editingSubjectId()
      ? this.api.put(`/subjects/${this.editingSubjectId()}`, { name })
      : this.api.post('/subjects', { name });
    req.subscribe({
      next: () => {
        this.subjectOpen.set(false);
        this.alerts.success(this.i18n.t('common.saved'));
        this.load();
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }

  subjectNames(course: CourseRow): string {
    return course.subjects.length ? course.subjects.map((s) => s.name).join(', ') : '—';
  }

  async removeSubject(id: string): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('common.deleteConfirm')))) return;
    this.api.delete(`/subjects/${id}`).subscribe({
      next: () => {
        this.alerts.success(this.i18n.t('common.deleted'));
        this.load();
      },
      error: (e) => this.alerts.error(apiErrorMessage(e))
    });
  }
}
