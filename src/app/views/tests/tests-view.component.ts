import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective, CardComponent, TableDirective } from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { TPipe } from '../../core/t.pipe';
import { formatClock } from './test.models';

type ViewQuestion = {
  id: string;
  sortOrder: number;
  subjectName: string;
  questionEn: string;
  questionHi: string;
  options: Array<{ en: string; hi: string }>;
  correctIndex: number;
  answerDescription: string;
};

type ViewAttempt = {
  studentName: string;
  marksObtained: number;
  timeSpentSeconds: number;
  rank: number;
};

type TestView = {
  id: string;
  name: string;
  courseName: string;
  durationMinutes: number;
  questionCount: number;
  totalMarks: number;
  subjects: string[];
  questions: ViewQuestion[];
  attempts: ViewAttempt[];
};

@Component({
  selector: 'app-tests-view',
  templateUrl: './tests-view.component.html',
  imports: [ButtonDirective, CardComponent, TableDirective, RouterLink, TPipe]
})
export class TestsViewComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly test = signal<TestView | null>(null);
  readonly subject = signal('');
  readonly error = signal('');

  readonly questions = computed(() => {
    const t = this.test();
    if (!t) return [];
    const sub = this.subject();
    return sub ? t.questions.filter((q) => q.subjectName === sub) : t.questions;
  });

  get backLink(): string[] {
    const id = this.route.snapshot.paramMap.get('branchId');
    return id ? ['/branches', id, 'add-tests'] : ['/add-tests'];
  }

  constructor() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get<TestView>(`/tests/${id}`).subscribe({
      next: (row) => {
        this.test.set(row);
        this.subject.set(row.subjects[0] || '');
      },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  clock(seconds: number): string {
    return formatClock(seconds);
  }
}
