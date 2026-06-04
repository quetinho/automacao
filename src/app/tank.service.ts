import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

export interface TankMeasurement {
  capacityPercent: number;
  lastMeasurementAt: string;
}

interface TankStateResponse {
  volume: number;
  medicao: string;
}

@Injectable({
  providedIn: 'root',
})
export class TankService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://minhacasa.sajeba.com.br/db/estado-tanque';

  getLastMeasurement(): Observable<TankMeasurement> {
    return this.http.get<TankStateResponse>(this.apiUrl).pipe(
      map((state) => ({
        capacityPercent: Math.round(Number(state.volume) * 10) / 10,
        lastMeasurementAt: this.normalizeDate(state.medicao),
      })),
      catchError(() =>
        of({
          capacityPercent: 70,
          lastMeasurementAt: new Date().toISOString(),
        }),
      ),
    );
  }

  private normalizeDate(value: string): string {
    const match = value?.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}:\d{2}:\d{2})$/);

    if (match) {
      const [, day, month, year, time] = match;
      return `${year}-${month}-${day}T${time}`;
    }

    return value;
  }
}
