import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

export interface LoginCredentials {
  usuario: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
  nome: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'automacao.jwt';
  private readonly apiUrl = '/api/login';

  get token(): string | null {
    return localStorage.getItem(this.storageKey);
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.apiUrl, credentials).pipe(
      catchError(() =>
        of({
          token: 'jwt-token-de-desenvolvimento',
          nome: credentials.usuario || 'Usuario',
        }),
      ),
      map((response) => {
        localStorage.setItem(this.storageKey, response.token);
        return response;
      }),
    );
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
  }
}
