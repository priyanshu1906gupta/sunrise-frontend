import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ButtonDirective, CardBodyComponent, CardComponent, FormControlDirective, FormDirective, FormLabelDirective,
  ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective
} from '@coreui/angular';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { onBranchRouteChange } from '../../core/on-branch-route';
import { TPipe } from '../../core/t.pipe';
import { IconDirective } from '@coreui/icons-angular';
import { ModalCloseComponent } from '../../shared/modal-close.component';
import { PhotoUploadComponent } from '../../shared/photo-upload.component';
import { PhotoPickerService } from '../../core/photo-picker.service';
import { FallbackSrcDirective } from '../../shared/fallback-src.directive';

@Component({
  selector: 'app-branch-view',
  templateUrl: './branch-view.component.html',
  imports: [
    ReactiveFormsModule, ButtonDirective, CardComponent, CardBodyComponent, FormDirective, FormControlDirective,
    FormLabelDirective, ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    TPipe, PhotoUploadComponent, ModalCloseComponent, IconDirective, FallbackSrcDirective
  ]
})
export class BranchViewComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly photos = inject(PhotoPickerService);

  readonly branch = signal<Record<string, unknown> | null>(null);
  readonly error = signal('');
  readonly editOpen = signal(false);
  readonly logoId = signal<string | null>(null);
  readonly photoIds = signal<string[]>([]);
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    ownerName: ['', Validators.required],
    address: [''],
    phone: [''],
    details: ['']
  });

  constructor() {
    onBranchRouteChange(() => this.load());
  }

  stashPhotoForm(): void {
    this.photos.stash(this.form.getRawValue(), { logoId: this.logoId(), photoIds: this.photoIds() });
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('branchId')!;
    this.api.get<Record<string, unknown>>(`/branches/${id}`).subscribe({
      next: (b) => {
        this.branch.set(b);
        this.restoreIfNeeded();
      },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }

  private restored = false;

  private restoreIfNeeded(): void {
    if (this.restored) return;
    this.restored = true;
    const session = this.photos.takeRestore('branch-edit');
    if (!session) return;
    this.restored = true;
    this.openEdit();
    if (session.form) this.form.patchValue(session.form as never);
    const extra = session.extra;
    if (typeof extra?.['logoId'] === 'string') this.logoId.set(extra['logoId']);
    if (Array.isArray(extra?.['photoIds'])) this.photoIds.set(extra['photoIds'] as string[]);
  }

  onEditVisible(visible: boolean): void {
    this.photos.onModalVisible(visible, (v) => this.editOpen.set(v));
  }

  openEdit(): void {
    const b = this.branch();
    if (!b) return;
    this.form.patchValue({
      name: b['name'] as string,
      ownerName: b['ownerName'] as string,
      address: (b['address'] as string) || '',
      phone: (b['phone'] as string) || '',
      details: (b['details'] as string) || ''
    });
    this.logoId.set(this.photos.peekDraft('branch-logo')?.id || (b['logoFileId'] as string) || null);
    const extra = this.photos.peekDraft('branch-photos');
    const existing = ((b['photos'] as { fileId: string }[]) || []).map((p) => p.fileId);
    this.photoIds.set(extra?.id && !existing.includes(extra.id) ? [...existing, extra.id].slice(-3) : existing);
    this.editOpen.set(true);
    this.photos.noteHost('branch-edit', this.route.snapshot.paramMap.get('branchId'));
  }

  save(): void {
    const id = this.route.snapshot.paramMap.get('branchId')!;
    this.api.put(`/branches/${id}`, {
      ...this.form.getRawValue(),
      logoFileId: this.logoId(),
      photoFileIds: this.photoIds()
    }).subscribe({
      next: () => {
        this.photos.clearDraft('branch-logo');
        this.photos.clearDraft('branch-photos');
        this.photos.clearSession();
        this.editOpen.set(false);
        this.load();
      },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }
}
