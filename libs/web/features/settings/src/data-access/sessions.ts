import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** `GET /api/v1/me/sessions`: one of the caller's sessions, never its token. */
export interface SessionView {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  current: boolean;
}

/** The caller's sessions, current first. Call in an injection context. */
export function sessionsResource() {
  return httpResource<SessionView[]>(() => '/api/v1/me/sessions', { defaultValue: [] });
}

/** Ending sessions through our own routes (Better Auth's need a fresh session). */
@Injectable({ providedIn: 'root' })
export class SessionsApi {
  private readonly http = inject(HttpClient);

  end(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/v1/me/sessions/${encodeURIComponent(id)}`));
  }

  endOthers(): Promise<void> {
    return firstValueFrom(this.http.delete<void>('/api/v1/me/sessions'));
  }
}
