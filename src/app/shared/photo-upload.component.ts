import { Component, OnDestroy, OnInit, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { ButtonDirective, FormLabelDirective, SpinnerComponent } from '@coreui/angular';
import { rewriteMediaUrl } from '../core/media-url';
import { PhotoPickerService } from '../core/photo-picker.service';
import { TPipe } from '../core/t.pipe';
import { FallbackSrcDirective } from './fallback-src.directive';

@Component({
  selector: 'app-photo-upload',
  standalone: true,
  imports: [ButtonDirective, FormLabelDirective, TPipe, SpinnerComponent, FallbackSrcDirective],
  template: `
    <div class="mb-2">
      @if (label()) {
        <label cLabel class="small mb-1">{{ label() }}</label>
      }
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <div class="position-relative">
          @if (preview()) {
            <img [src]="preview()" appFallbackSrc alt="" class="rounded border ff-photo-preview" />
          } @else {
            <div class="rounded border d-flex align-items-center justify-content-center bg-body-secondary ff-photo-preview">
              <span class="small text-body-secondary">{{ 'common.photo' | t }}</span>
            </div>
          }
          @if (uploading()) {
            <div class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center rounded"
                 style="background: rgba(0,0,0,.4)">
              <c-spinner color="light" size="sm" />
            </div>
          }
        </div>
        <div class="d-flex gap-2">
          <button cButton color="primary" variant="outline" size="sm" type="button" [disabled]="uploading()" (click)="openPicker(false)">
            {{ 'common.upload' | t }}
          </button>
          <button cButton color="secondary" variant="outline" size="sm" type="button" [disabled]="uploading()" (click)="openPicker(true)">
            {{ 'common.camera' | t }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class PhotoUploadComponent implements OnInit, OnDestroy {
  private readonly picker = inject(PhotoPickerService);
  readonly label = input('');
  readonly persistKey = input('photo');
  readonly url = input<string | null>(null);
  readonly fileId = input<string | null>(null);
  readonly picking = output<void>();
  readonly uploaded = output<{ id: string; url: string }>();
  readonly preview = linkedSignal(() => rewriteMediaUrl(this.url()));
  readonly uploading = signal(false);
  private savedId: string | null = null;
  private destroyed = false;
  private openedAt = Date.now();

  constructor() {
    effect(() => {
      const latest = this.picker.latest();
      if (!latest || latest.key !== this.persistKey() || latest.at < this.openedAt - 500) return;
      this.preview.set(latest.url);
      this.uploaded.emit({ id: latest.id, url: latest.url });
      this.uploading.set(false);
    });
  }

  ngOnInit(): void {
    this.savedId = this.fileId();
    const draft = this.picker.peekDraft(this.persistKey());
    if (draft && !this.url()) {
      this.preview.set(draft.url);
      this.uploaded.emit({ id: draft.id, url: draft.url });
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  openPicker(camera: boolean): void {
    this.picking.emit();
    void this.picker.pick(camera).then((file) => {
      if (!file) return;
      const localUrl = this.destroyed ? '' : URL.createObjectURL(file);
      if (!this.destroyed) {
        this.preview.set(localUrl);
        this.uploading.set(true);
      }
      void this.picker.uploadPicked(file, this.persistKey(), this.savedId).then(
        (dto) => {
          if (this.destroyed) return;
          this.uploaded.emit(dto);
          const probe = new Image();
          probe.onload = () => {
            if (localUrl) URL.revokeObjectURL(localUrl);
            if (!this.destroyed) this.preview.set(dto.url);
          };
          probe.onerror = () => {
            if (!this.destroyed && localUrl) this.preview.set(localUrl);
          };
          probe.src = dto.url;
          this.uploading.set(false);
        },
        () => {
          if (this.destroyed) return;
          this.preview.set(rewriteMediaUrl(this.url()));
          this.uploading.set(false);
        }
      );
    });
  }
}
