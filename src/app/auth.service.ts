import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

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
  private readonly apiUrl = '/db/login';

  get token(): string | null {
    return localStorage.getItem(this.storageKey);
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.apiUrl, credentials).pipe(
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
