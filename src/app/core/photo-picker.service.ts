import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { compressForUpload } from './compress-image';
import { rewriteMediaUrl } from './media-url';
import { FileDto } from './models';
import { LoaderService } from './loader.service';

export interface PhotoDraft {
  id: string;
  url: string;
  at: number;
}

export interface PhotoFormSession {
  host: string;
  editingId: string | null;
  form?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  armed?: boolean;
  hash: string;
  at: number;
}

const PREFIX = 'ff.photo.draft:';
const RETURN_KEY = 'ff.camera.return';
const SESSION_KEY = 'ff.photo.session';
const FRESH_MS = 15 * 60 * 1000;
const HOLD_AFTER_MS = 3000;
const TAP_GUARD_MS = 8000;
const MULTI_KEYS = new Set(['branch-photos', 'company-photos']);

/** Stop camera/file-picker from native-submitting modal forms (full page reload on phones). */
export function installPhotoCameraGuards(): void {
  if (typeof document === 'undefined') return;
  restoreHashAfterCamera();
  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const action = (form.getAttribute('action') || '').trim();
      if (!action || action === '#') event.preventDefault();
    },
    true
  );
}

function restoreHashAfterCamera(): void {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY) || localStorage.getItem(RETURN_KEY);
    if (!raw) return;
    sessionStorage.removeItem(RETURN_KEY);
    localStorage.removeItem(RETURN_KEY);
    const data = JSON.parse(raw) as { hash: string; at: number };
    if (!data?.hash || Date.now() - data.at > FRESH_MS) return;
    if (window.location.hash !== data.hash) {
      window.location.hash = data.hash;
    }
  } catch {
    /* ignore */
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeStore(key: string): void {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

@Injectable({ providedIn: 'root' })
export class PhotoPickerService {
  private readonly loader = inject(LoaderService);
  private readonly api = inject(ApiService);
  readonly blocking = signal(false);
  readonly latest = signal<{ key: string; id: string; url: string; at: number } | null>(null);
  private busyUntil = 0;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private loaderHeld = false;
  private galleryInput?: HTMLInputElement;
  private cameraInput?: HTMLInputElement;

  constructor() {
    this.resumeFromCamera();
  }

  isBusy(): boolean {
    return this.blocking() || Date.now() < this.busyUntil;
  }

  noteHost(host: string, editingId: string | null): void {
    this.patchSession({ host, editingId, hash: window.location.hash, at: Date.now() });
  }

  stash(form: Record<string, unknown>, extra?: Record<string, unknown>): void {
    this.patchSession({ form, extra, hash: window.location.hash, at: Date.now() });
  }

  takeRestore(host: string): PhotoFormSession | null {
    const session = this.peekSession();
    if (!session?.armed || session.host !== host) return null;
    if (Date.now() - session.at > FRESH_MS) {
      this.clearSession();
      return null;
    }
    this.patchSession({ armed: false });
    return session;
  }

  peekSession(): PhotoFormSession | null {
    const raw = readStore(SESSION_KEY);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as PhotoFormSession;
      if (!session?.host) return null;
      return session;
    } catch {
      return null;
    }
  }

  clearSession(): void {
    removeStore(SESSION_KEY);
  }

  markBusy(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
    this.blocking.set(true);
    this.busyUntil = Date.now() + 120_000;
    if (!this.loaderHeld) {
      this.loaderHeld = true;
      this.loader.suppress();
    }
    store(RETURN_KEY, JSON.stringify({ hash: window.location.hash, at: Date.now() }));
    this.patchSession({
      armed: true,
      hash: window.location.hash,
      at: Date.now()
    });
  }

  markIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.busyUntil = Date.now() + TAP_GUARD_MS;
    this.idleTimer = setTimeout(() => {
      this.blocking.set(false);
      this.idleTimer = undefined;
      if (this.loaderHeld) {
        this.loaderHeld = false;
        this.loader.unsuppress();
      }
    }, HOLD_AFTER_MS);
  }

  /** Keep the add/edit modal open while the camera is open or the leftover tap would close it. */
  onModalVisible(visible: boolean, apply: (visible: boolean) => void): void {
    if (!visible && this.isBusy()) {
      apply(true);
      setTimeout(() => apply(true), 0);
      setTimeout(() => apply(true), 120);
      setTimeout(() => apply(true), 400);
      return;
    }
    if (!visible) this.patchSession({ armed: false });
    apply(visible);
  }

  pick(camera: boolean): Promise<File | null> {
    this.markBusy();
    const input = this.ensureInput(camera);
    return new Promise((resolve) => {
      const finish = (file: File | null) => {
        input.value = '';
        input.removeEventListener('change', onChange);
        resolve(file);
        if (!file) this.markIdle();
      };
      const onChange = () => {
        const picked = input.files?.[0];
        if (!picked) {
          finish(null);
          return;
        }
        finish(new File([picked], picked.name, { type: picked.type || 'image/jpeg', lastModified: picked.lastModified }));
      };
      input.addEventListener('change', onChange);
      input.click();
    });
  }

  /** Upload lives on the singleton so a closed modal cannot cancel the request. */
  uploadPicked(file: File, persistKey: string, savedFileId: string | null): Promise<{ id: string; url: string }> {
    this.markBusy();
    return this.runUpload(file, persistKey, savedFileId).finally(() => this.markIdle());
  }

  saveDraft(key: string, id: string, url: string): void {
    const draft: PhotoDraft = { id, url: rewriteMediaUrl(url) || url, at: Date.now() };
    store(PREFIX + key, JSON.stringify(draft));
  }

  peekDraft(key: string): PhotoDraft | null {
    const raw = readStore(PREFIX + key);
    if (!raw) return null;
    try {
      const draft = JSON.parse(raw) as PhotoDraft;
      if (!draft?.id || Date.now() - draft.at > FRESH_MS) {
        this.clearDraft(key);
        return null;
      }
      return { ...draft, url: rewriteMediaUrl(draft.url) || draft.url };
    } catch {
      return null;
    }
  }

  clearDraft(key: string): void {
    removeStore(PREFIX + key);
  }

  private resumeFromCamera(): void {
    const session = this.peekSession();
    if (!session?.armed || Date.now() - session.at > FRESH_MS) return;
    this.blocking.set(true);
    this.busyUntil = Date.now() + TAP_GUARD_MS;
    if (!this.loaderHeld) {
      this.loaderHeld = true;
      this.loader.suppress();
    }
    this.markIdle();
  }

  private patchSession(partial: Partial<PhotoFormSession>): void {
    const prev = this.peekSession() || {
      host: '',
      editingId: null,
      hash: typeof window !== 'undefined' ? window.location.hash : '',
      at: Date.now()
    };
    store(SESSION_KEY, JSON.stringify({ ...prev, ...partial, at: partial.at ?? Date.now() }));
  }

  private async runUpload(file: File, persistKey: string, savedFileId: string | null): Promise<{ id: string; url: string }> {
    let toUpload = file;
    try {
      toUpload = await compressForUpload(file);
    } catch {
      toUpload = file;
    }
    const dto = await firstValueFrom(this.api.upload<FileDto>('/files', toUpload));
    this.dropUnusedDraft(persistKey, savedFileId, dto.id);
    const url = rewriteMediaUrl(dto.url) || dto.url;
    this.saveDraft(persistKey, dto.id, url);
    this.latest.set({ key: persistKey, id: dto.id, url, at: Date.now() });
    return { id: dto.id, url };
  }

  private dropUnusedDraft(persistKey: string, savedFileId: string | null, keepId: string): void {
    if (MULTI_KEYS.has(persistKey)) return;
    const prev = this.peekDraft(persistKey);
    if (!prev?.id || prev.id === keepId || prev.id === savedFileId) return;
    this.api.delete(`/files/${prev.id}`).subscribe({ error: () => undefined });
  }

  private ensureInput(camera: boolean): HTMLInputElement {
    const existing = camera ? this.cameraInput : this.galleryInput;
    if (existing) return existing;
    const el = document.createElement('input');
    el.type = 'file';
    el.accept = 'image/jpeg,image/png,image/*';
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    if (camera) el.setAttribute('capture', 'environment');
    el.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(el);
    if (camera) this.cameraInput = el;
    else this.galleryInput = el;
    return el;
  }
}
