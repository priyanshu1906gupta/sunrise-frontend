import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  readonly count = signal(0);
  readonly active = signal(false);
  private suppressed = 0;

  begin(): void {
    this.count.update((n) => n + 1);
    this.sync();
  }

  end(): void {
    this.count.update((n) => Math.max(0, n - 1));
    this.sync();
  }

  suppress(): void {
    this.suppressed += 1;
    this.active.set(false);
  }

  unsuppress(): void {
    this.suppressed = Math.max(0, this.suppressed - 1);
    this.sync();
  }

  private sync(): void {
    this.active.set(this.count() > 0 && this.suppressed === 0);
  }
}
