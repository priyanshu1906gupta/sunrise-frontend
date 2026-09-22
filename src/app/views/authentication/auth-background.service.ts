import { Injectable, signal } from '@angular/core';

const INTERVAL_MS = 5 * 60 * 1000;
const FALLBACK_LOGO = 'assets/brand/logo.png';

@Injectable({ providedIn: 'root' })
export class AuthBackgroundService {
  readonly images = signal<string[]>([FALLBACK_LOGO]);
  readonly index = signal(0);
  readonly useContain = signal(true);

  private timer?: ReturnType<typeof setTimeout>;
  private refs = 0;
  private list: string[] = [FALLBACK_LOGO];

  apply(loginImages: string[] | undefined, logoUrl: string | null | undefined): void {
    if (loginImages?.length) {
      this.list = loginImages;
      this.useContain.set(false);
    } else {
      this.list = [logoUrl || FALLBACK_LOGO];
      this.useContain.set(true);
    }
    this.images.set(this.list);
    this.index.set(this.slotIndex());
  }

  start(): void {
    this.refs += 1;
    if (this.refs === 1) this.arm();
  }

  stop(): void {
    this.refs = Math.max(0, this.refs - 1);
    if (this.refs === 0 && this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private slotIndex(): number {
    if (!this.list.length) return 0;
    return Math.floor(Date.now() / INTERVAL_MS) % this.list.length;
  }

  private arm(): void {
    this.index.set(this.slotIndex());
    const wait = INTERVAL_MS - (Date.now() % INTERVAL_MS);
    this.timer = setTimeout(() => this.arm(), wait);
  }
}
