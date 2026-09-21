import { AfterViewInit, Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from '@coreui/angular';
import Swal from 'sweetalert2';
import { AlertService } from '../../core/alert.service';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { I18nService } from '../../core/i18n.service';
import { TPipe } from '../../core/t.pipe';
import {
  ExamQuestion,
  ExamStart,
  LocalAnswer,
  TestResult,
  formatClock
} from './test.models';

type Store = {
  answers: Record<string, LocalAnswer>;
  currentIndex: number;
  lang: 'en' | 'hi';
};

@Component({
  selector: 'app-test-exam',
  templateUrl: './test-exam.component.html',
  styleUrl: './test-exam.component.scss',
  imports: [ButtonDirective, RouterLink, TPipe]
})
export class TestExamComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nService);

  readonly review = this.route.snapshot.data['review'] === true;
  readonly testId = this.route.snapshot.paramMap.get('id')!;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly name = signal('');
  readonly questions = signal<ExamQuestion[]>([]);
  readonly currentIndex = signal(0);
  readonly lang = signal<'en' | 'hi'>('en');
  readonly remaining = signal(0);
  readonly answers = signal<Record<string, LocalAnswer>>({});
  readonly clock = computed(() => formatClock(this.remaining()));

  readonly current = computed(() => this.questions()[this.currentIndex()] ?? null);

  private attemptId = '';
  private warningCount = 0;
  private timer?: ReturnType<typeof setInterval>;
  private beat?: ReturnType<typeof setInterval>;
  private handlingViolation = false;
  private submitted = false;

  constructor() {
    if (this.review) this.loadReview();
    else this.loadStart();
  }

  ngAfterViewInit(): void {
    if (!this.review) void this.enterFullscreen();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(_event: KeyboardEvent): void {
    if (this.review || this.submitted || document.querySelector('.swal2-container')) return;
    void this.violate();
  }

  @HostListener('document:fullscreenchange')
  onFs(): void {
    if (this.review || this.submitted || document.fullscreenElement) return;
    void this.violate();
  }

  questionTitle(): string {
    return this.i18n
      .t('tests.questionOf')
      .replace('{n}', String(this.currentIndex() + 1))
      .replace('{total}', String(this.questions().length));
  }

  optionLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  optionText(opt: { en: string; hi: string }): string {
    return this.lang() === 'hi' ? opt.hi || opt.en : opt.en || opt.hi;
  }

  questionText(q: ExamQuestion): string {
    return this.lang() === 'hi' ? q.questionHi || q.questionEn : q.questionEn || q.questionHi;
  }

  paletteClass(q: ExamQuestion): string {
    const ans = this.answers()[q.id];
    const active = this.current()?.id === q.id ? ' is-current' : '';
    if (!ans?.visited) return `exam-pal p-idle${active}`;
    if (ans.markedForReview && ans.selectedIndex != null) return `exam-pal p-answered-review${active}`;
    if (ans.markedForReview) return `exam-pal p-review${active}`;
    if (ans.selectedIndex != null) return `exam-pal p-answered${active}`;
    return `exam-pal p-not-answered${active}`;
  }

  optionClass(q: ExamQuestion, index1: number): string {
    const selected = this.answers()[q.id]?.selectedIndex;
    if (this.review) {
      if (q.correctIndex === index1) return 'opt-correct';
      if (selected === index1 && selected !== q.correctIndex) return 'opt-wrong';
      return '';
    }
    return selected === index1 ? 'opt-selected' : '';
  }

  timeOnQuestion(q: ExamQuestion | null): string {
    if (!q) return formatClock(0);
    const spent = this.review ? (q.secondsSpent ?? 0) : this.answers()[q.id]?.secondsSpent ?? 0;
    return formatClock(spent);
  }

  setLang(lang: 'en' | 'hi'): void {
    this.lang.set(lang);
    this.persist();
  }

  go(index: number): void {
    const q = this.current();
    if (q) this.patchAnswer(q.id, { visited: true });
    this.currentIndex.set(Math.max(0, Math.min(index, this.questions().length - 1)));
    const next = this.questions()[this.currentIndex()];
    if (next) this.patchAnswer(next.id, { visited: true });
    this.persist();
  }

  select(index1: number): void {
    if (this.review) return;
    const q = this.current();
    if (!q) return;
    this.patchAnswer(q.id, { selectedIndex: index1, visited: true });
  }

  clear(): void {
    const q = this.current();
    if (!q || this.review) return;
    this.patchAnswer(q.id, { selectedIndex: null, visited: true });
  }

  markReview(): void {
    const q = this.current();
    if (!q || this.review) return;
    this.patchAnswer(q.id, { markedForReview: true, visited: true });
    this.go(this.currentIndex() + 1);
  }

  saveNext(): void {
    const q = this.current();
    if (q) this.patchAnswer(q.id, { visited: true });
    this.go(this.currentIndex() + 1);
  }

  previous(): void {
    this.go(this.currentIndex() - 1);
  }

  async submitClicked(): Promise<void> {
    if (!(await this.confirm.ask(this.i18n.t('tests.submitConfirm')))) return;
    await this.submit(false);
  }

  private loadStart(): void {
    this.api.post<ExamStart | TestResult>(`/tests/${this.testId}/start`, {}).subscribe({
      next: (data) => {
        if (this.isResult(data)) {
          this.finishToResult();
          return;
        }
        this.attemptId = data.attemptId;
        this.name.set(data.name);
        this.questions.set(data.questions);
        this.remaining.set(data.remainingSeconds);
        this.warningCount = data.warningCount || 0;
        this.restoreStore(data);
        this.loading.set(false);
        this.startTimers();
        void this.enterFullscreen();
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(e));
      }
    });
  }

  private loadReview(): void {
    this.api.get<{ name: string; questions: ExamQuestion[] }>(`/tests/${this.testId}/review`).subscribe({
      next: (data) => {
        this.name.set(data.name);
        this.questions.set(data.questions);
        const answers: Record<string, LocalAnswer> = {};
        for (const q of data.questions) {
          answers[q.id] = {
            selectedIndex: q.selectedIndex ?? null,
            markedForReview: false,
            visited: true,
            secondsSpent: q.secondsSpent ?? 0
          };
        }
        this.answers.set(answers);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(e));
      }
    });
  }

  private restoreStore(data: ExamStart): void {
    const raw = localStorage.getItem(`sunrise_test_${data.attemptId}`);
    let store: Store | null = null;
    try {
      store = raw ? (JSON.parse(raw) as Store) : null;
    } catch {
      store = null;
    }
    const answers: Record<string, LocalAnswer> = {};
    for (const q of data.questions) {
      answers[q.id] = store?.answers?.[q.id] ?? {
        selectedIndex: null,
        markedForReview: false,
        visited: false,
        secondsSpent: 0
      };
    }
    this.answers.set(answers);
    this.currentIndex.set(store?.currentIndex ?? 0);
    this.lang.set(store?.lang ?? 'en');
    const first = data.questions[this.currentIndex()];
    if (first) this.patchAnswer(first.id, { visited: true });
    this.persist();
  }

  private persist(): void {
    if (!this.attemptId || this.review) return;
    const store: Store = {
      answers: this.answers(),
      currentIndex: this.currentIndex(),
      lang: this.lang()
    };
    localStorage.setItem(`sunrise_test_${this.attemptId}`, JSON.stringify(store));
  }

  private payload() {
    return Object.entries(this.answers()).map(([questionId, a]) => ({
      questionId,
      selectedIndex: a.selectedIndex,
      markedForReview: a.markedForReview,
      secondsSpent: a.secondsSpent
    }));
  }

  private startTimers(): void {
    this.clearTimers();
    this.timer = setInterval(() => {
      const q = this.current();
      if (q) this.patchAnswer(q.id, { secondsSpent: (this.answers()[q.id]?.secondsSpent ?? 0) + 1 }, false);
      const next = this.remaining() - 1;
      this.remaining.set(Math.max(0, next));
      this.persist();
      if (next <= 0) void this.submit(true);
    }, 1000);
    this.beat = setInterval(() => this.heartbeat(), 15000);
  }

  private heartbeat(): void {
    if (this.review || this.submitted) return;
    this.api
      .put<Record<string, unknown>>(`/tests/${this.testId}/heartbeat`, {
        remainingSeconds: this.remaining(),
        warningCount: this.warningCount,
        answers: this.payload()
      })
      .subscribe({
        next: (data) => {
          if (this.isResult(data)) this.finishToResult();
          else if (typeof data['remainingSeconds'] === 'number') this.remaining.set(data['remainingSeconds'] as number);
        },
        error: () => undefined
      });
  }

  private async submit(auto: boolean): Promise<void> {
    if (this.submitted || this.review) return;
    this.submitted = true;
    this.clearTimers();
    this.api
      .post<TestResult>(`/tests/${this.testId}/submit`, { auto, answers: this.payload() })
      .subscribe({
        next: () => this.finishToResult(),
        error: (e) => {
          this.submitted = false;
          this.alerts.error(apiErrorMessage(e));
          if (!auto) this.startTimers();
        }
      });
  }

  private finishToResult(): void {
    this.clearTimers();
    if (this.attemptId) localStorage.removeItem(`sunrise_test_${this.attemptId}`);
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    void this.router.navigate(['/tests', this.testId, 'result']);
  }

  private patchAnswer(id: string, patch: Partial<LocalAnswer>, save = true): void {
    this.answers.update((cur) => ({
      ...cur,
      [id]: {
        selectedIndex: cur[id]?.selectedIndex ?? null,
        markedForReview: cur[id]?.markedForReview ?? false,
        visited: cur[id]?.visited ?? false,
        secondsSpent: cur[id]?.secondsSpent ?? 0,
        ...patch
      }
    }));
    if (save) this.persist();
  }

  private async violate(): Promise<void> {
    if (this.handlingViolation || this.submitted) return;
    this.handlingViolation = true;
    this.warningCount += 1;
    this.heartbeat();
    if (this.warningCount >= 2) {
      await this.submit(true);
      return;
    }
    await Swal.fire({
      icon: 'warning',
      title: this.i18n.t('tests.warningTitle'),
      text: this.i18n.t('tests.warningBody'),
      confirmButtonColor: '#2eb85c'
    });
    this.handlingViolation = false;
    void this.enterFullscreen();
  }

  private async enterFullscreen(): Promise<void> {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    } catch {
      /* browsers may require a gesture */
    }
  }

  private clearTimers(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.beat) clearInterval(this.beat);
    this.timer = undefined;
    this.beat = undefined;
  }

  private isResult(value: unknown): value is TestResult {
    return Boolean(value && typeof value === 'object' && 'rank' in value && 'marksObtained' in value);
  }
}
