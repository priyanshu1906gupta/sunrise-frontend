import { Injectable, signal } from '@angular/core';

const INTERVAL_MS = 5 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthBackgroundService {
  readonly images = [
    'assets/auth/bg-1.webp',
    'assets/auth/bg-2.webp',
    'assets/auth/bg-3.webp',
    'assets/auth/bg-4.webp',
    'assets/auth/bg-5.webp',
    'assets/auth/bg-6.webp',
    'assets/auth/bg-7.webp',
    // 'assets/auth/bg-8.webp',
    // 'assets/auth/bg-9.webp',
    // 'assets/auth/bg-10.webp',
  ] as const;

  readonly index = signal(this.slotIndex());

  private timer?: ReturnType<typeof setTimeout>;
  private refs = 0;

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
    return Math.floor(Date.now() / INTERVAL_MS) % this.images.length;
  }

  private arm(): void {
    this.index.set(this.slotIndex());
    const wait = INTERVAL_MS - (Date.now() % INTERVAL_MS);
    this.timer = setTimeout(() => this.arm(), wait);
  }
}
