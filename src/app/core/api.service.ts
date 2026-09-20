import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from './models';

/** Use the page hostname so phone/LAN testing hits this PC, not the phone's localhost. */
function resolveApiUrl(): string {
  const configured = environment.apiUrl;
  if (environment.production || typeof window === 'undefined') return configured;
  try {
    const url = new URL(configured);
    url.hostname = window.location.hostname;
    const path = url.pathname.replace(/\/$/, '');
    return `${url.origin}${path}`;
  } catch {
    return configured;
  }
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly base = resolveApiUrl();

  get<T>(path: string, params?: Record<string, string | number | undefined | null>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, String(value));
        }
      }
    }
    return this.http.get<ApiResponse<T>>(`${this.base}${path}`, { params: httpParams }).pipe(map((r) => r.data));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(`${this.base}${path}`, body).pipe(map((r) => r.data));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<ApiResponse<T>>(`${this.base}${path}`, body).pipe(map((r) => r.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<ApiResponse<T>>(`${this.base}${path}`).pipe(map((r) => r.data));
  }

  download(path: string, params?: Record<string, string | number | undefined | null>): Observable<Blob> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, String(value));
        }
      }
    }
    return this.http.get(`${this.base}${path}`, { params: httpParams, responseType: 'blob' });
  }

  upload<T>(path: string, file: File): Observable<T> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ApiResponse<T>>(`${this.base}${path}`, form).pipe(map((r) => r.data));
  }
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (!(blob instanceof Blob)) {
    throw new Error('Download failed');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function apiErrorMessage(err: unknown): string {
  const e = err as {
    status?: number;
    message?: string;
    error?: { message?: string; errors?: Record<string, Array<string | undefined> | undefined> } | { message?: string };
  };
  if (e?.status === 0) {
    return 'Cannot reach the server. Use this PC\'s Wi-Fi address and keep the API running.';
  }
  const fields = e?.error && 'errors' in e.error && e.error.errors
    ? Object.values(e.error.errors)
        .flat()
        .filter((msg): msg is string => Boolean(msg))
        .join(' ')
    : '';
  const nested = e?.error && typeof e.error === 'object' && !(e.error instanceof Blob) ? e.error.message : undefined;
  return fields || nested || e?.message || 'Something went wrong';
}
