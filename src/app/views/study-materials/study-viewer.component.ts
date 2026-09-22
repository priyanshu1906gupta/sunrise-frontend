import { Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective } from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AlertService } from '../../core/alert.service';
import { TPipe } from '../../core/t.pipe';

@Component({
  selector: 'app-study-viewer',
  templateUrl: './study-viewer.component.html',
  styleUrl: './study-viewer.component.scss',
  imports: [ButtonDirective, RouterLink, TPipe]
})
export class StudyViewerComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly alerts = inject(AlertService);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('pageCanvas');

  readonly error = signal('');
  readonly loading = signal(true);
  readonly page = signal(1);
  readonly pages = signal(1);
  private pdf: { numPages: number; getPage: (n: number) => Promise<unknown> } | null = null;
  private rendering = false;

  get backLink(): string[] {
    const branchId = this.route.snapshot.paramMap.get('branchId');
    return branchId ? ['/branches', branchId, 'study-materials'] : ['/study-materials'];
  }

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Not found');
      this.loading.set(false);
      return;
    }
    this.api.download(`/study-materials/${id}/file`).subscribe({
      next: (blob) => void this.open(blob),
      error: (e) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(e));
      }
    });
  }

  ngOnDestroy(): void {
    this.pdf = null;
  }

  async prev(): Promise<void> {
    if (this.page() <= 1) return;
    this.page.update((n) => n - 1);
    await this.render();
  }

  async next(): Promise<void> {
    if (this.page() >= this.pages()) return;
    this.page.update((n) => n + 1);
    await this.render();
  }

  private async open(blob: Blob): Promise<void> {
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs';
      const data = await blob.arrayBuffer();
      const doc = await pdfjs.getDocument({ data, disableStream: true, disableRange: true }).promise;
      this.pdf = doc;
      this.pages.set(doc.numPages);
      this.page.set(1);
      this.loading.set(false);
      setTimeout(() => void this.render(), 0);
    } catch (e) {
      this.loading.set(false);
      this.error.set(apiErrorMessage(e) || 'Could not open PDF');
    }
  }

  private async render(): Promise<void> {
    const pdf = this.pdf;
    const canvas = this.canvasRef()?.nativeElement;
    if (!pdf || !canvas || this.rendering) return;
    this.rendering = true;
    try {
      const page = (await pdf.getPage(this.page())) as {
        getViewport: (opts: { scale: number }) => { width: number; height: number };
        render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
      };
      const viewport = page.getViewport({ scale: 1.25 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } finally {
      this.rendering = false;
    }
  }
}
