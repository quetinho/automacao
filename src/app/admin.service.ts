import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface TankConfiguration {
  distanciaCheio: number;
  distanciaVazio: number;
}

export interface ExtremeMeasurement {
  valor: number;
  dt: string;
}

export interface TankExtremes {
  menorDistancia: ExtremeMeasurement | null;
  maiorDistancia: ExtremeMeasurement | null;
  total: number;
  primeiraMedicao: string | null;
  ultimaMedicao: string | null;
}

export interface DailyLevel {
  distancia: number;
  percentual: number;
  dt: string;
}

export interface DailyTankExtremes {
  data: string;
  nivelMaisAlto: DailyLevel;
  nivelMaisBaixo: DailyLevel;
}

export interface TelegramRegistration {
  id: number;
  nome: string | null;
  send: string;
  enviar: boolean;
  dt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/db/admin';

  getTankConfiguration(): Observable<TankConfiguration> {
    return this.http.get<TankConfiguration>(`${this.apiUrl}/tanque/configuracao`);
  }

  updateTankConfiguration(
    configuration: TankConfiguration,
  ): Observable<{ message: string; configuracao: TankConfiguration }> {
    return this.http.put<{ message: string; configuracao: TankConfiguration }>(
      `${this.apiUrl}/tanque/configuracao`,
      configuration,
    );
  }

  getTankExtremes(): Observable<TankExtremes> {
    return this.http.get<TankExtremes>(`${this.apiUrl}/tanque/extremos`);
  }

  getFiveDayExtremes(): Observable<DailyTankExtremes[]> {
    return this.http.get<DailyTankExtremes[]>(
      `${this.apiUrl}/tanque/extremos-cinco-dias`,
    );
  }

  getPendingTelegramRegistrations(): Observable<TelegramRegistration[]> {
    return this.http.get<TelegramRegistration[]>(
      `${this.apiUrl}/telegram/pendentes`,
    );
  }

  updateTelegram(
    registration: TelegramRegistration,
  ): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/telegram/${registration.id}`,
      {
        nome: registration.nome,
        enviar: registration.enviar,
      },
    );
  }
}
