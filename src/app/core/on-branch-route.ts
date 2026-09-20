import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, merge } from 'rxjs';

/** Reloads when navigating between `/branches/:id/...` pages that reuse the same component. */
export function onBranchRouteChange(load: () => void): void {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  let key = '\0';
  merge(route.paramMap, router.events.pipe(filter((e) => e instanceof NavigationEnd)))
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe(() => {
      const next = route.snapshot.paramMap.get('branchId') ?? '';
      if (next === key) return;
      key = next;
      load();
    });
}
