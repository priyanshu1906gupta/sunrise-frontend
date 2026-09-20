import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';

export const DEFAULT_PHOTO = 'assets/brand/logo.png';

/** If a remote photo 404s (file removed from disk), show the default logo instead of a broken icon. */
@Directive({
  selector: 'img[appFallbackSrc]',
  standalone: true
})
export class FallbackSrcDirective {
  private readonly el = inject(ElementRef<HTMLImageElement>);
  readonly appFallbackSrc = input<string>('');

  @HostListener('error')
  onError(): void {
    const img = this.el.nativeElement;
    if (img.dataset['fallbackApplied'] === '1') return;
    img.dataset['fallbackApplied'] = '1';
    img.src = this.appFallbackSrc() || DEFAULT_PHOTO;
  }
}
