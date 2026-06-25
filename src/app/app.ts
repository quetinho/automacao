import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';

import {
  AdminService,
  DailyTankExtremes,
  TankConfiguration,
  TankExtremes,
  TelegramRegistration,
} from './admin.service';
import { AuthService } from './auth.service';
import { TankMeasurement, TankService } from './tank.service';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    PasswordModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly tankService = inject(TankService);
  private readonly adminService = inject(AdminService);

  protected readonly measurement = signal<TankMeasurement | null>(null);
  protected readonly loadingMeasurement = signal(true);
  protected readonly loginVisible = signal(false);
  protected readonly authenticated = signal(this.authService.isLoggedIn);
  protected readonly loginError = signal('');
  protected readonly usuario = signal('');
  protected readonly senha = signal('');

  protected readonly loadingAdmin = signal(false);
  protected readonly savingConfiguration = signal(false);
  protected readonly adminError = signal('');
  protected readonly adminMessage = signal('');
  protected readonly configuration = signal<TankConfiguration>({
    distanciaCheio: 34.11,
    distanciaVazio: 113,
  });
  protected readonly extremes = signal<TankExtremes | null>(null);
  protected readonly dailyExtremes = signal<DailyTankExtremes[]>([]);
  protected readonly pendingTelegrams = signal<TelegramRegistration[]>([]);
  protected readonly savingTelegramId = signal<number | null>(null);

  protected readonly waterLevel = computed(() => {
    const value = this.measurement()?.capacityPercent ?? 0;
    return Math.max(0, Math.min(100, value));
  });

  protected readonly highLevelPoints = computed(() =>
    this.createChartPoints('nivelMaisAlto'),
  );
  protected readonly lowLevelPoints = computed(() =>
    this.createChartPoints('nivelMaisBaixo'),
  );

  ngOnInit(): void {
    this.loadMeasurement();
    if (this.authenticated()) {
      this.loadAdminData();
    }
  }

  protected openLogin(): void {
    this.loginError.set('');
    this.loginVisible.set(true);
  }

  protected login(): void {
    this.loginError.set('');

    this.authService
      .login({ usuario: this.usuario(), senha: this.senha() })
      .subscribe({
        next: () => {
          this.authenticated.set(true);
          this.loginVisible.set(false);
          this.senha.set('');
          this.loadAdminData();
        },
        error: () => this.loginError.set('Usuário ou senha inválidos.'),
      });
  }

  protected logout(): void {
    this.authService.logout();
    this.authenticated.set(false);
    this.adminMessage.set('');
    this.adminError.set('');
  }

  protected updateDistance(
    field: keyof TankConfiguration,
    value: string | number,
  ): void {
    this.configuration.update((current) => ({
      ...current,
      [field]: Number(value),
    }));
  }

  protected saveConfiguration(): void {
    this.adminError.set('');
    this.adminMessage.set('');
    this.savingConfiguration.set(true);
    this.adminService
      .updateTankConfiguration(this.configuration())
      .pipe(finalize(() => this.savingConfiguration.set(false)))
      .subscribe({
        next: (result) => {
          this.configuration.set(result.configuracao);
          this.adminMessage.set(result.message);
          this.loadMeasurement();
          this.loadTankData();
        },
        error: (error: HttpErrorResponse) =>
          this.adminError.set(
            error.error?.message ?? 'Não foi possível salvar a configuração.',
          ),
      });
  }

  protected saveTelegram(registration: TelegramRegistration): void {
    this.adminError.set('');
    this.adminMessage.set('');
    this.savingTelegramId.set(registration.id);
    this.adminService
      .updateTelegram(registration)
      .pipe(finalize(() => this.savingTelegramId.set(null)))
      .subscribe({
        next: (result) => {
          this.adminMessage.set(result.message);
          this.pendingTelegrams.update((items) =>
            items.filter((item) => item.id !== registration.id),
          );
        },
        error: (error: HttpErrorResponse) =>
          this.adminError.set(
            error.error?.message ?? 'Não foi possível atualizar o Telegram.',
          ),
      });
  }

  protected chartX(index: number): number {
    const count = this.dailyExtremes().length;
    return count <= 1 ? 350 : 55 + (index * 600) / (count - 1);
  }

  protected chartY(percent: number): number {
    return 220 - (Math.max(0, Math.min(100, percent)) / 100) * 190;
  }

  protected normalizeDate(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const brazilianDate = value.match(
      /^(\d{2})[/-](\d{2})[/-](\d{4})(?:\s+(\d{2}:\d{2}:\d{2}))?$/,
    );
    if (brazilianDate) {
      const [, day, month, year, time = '00:00:00'] = brazilianDate;
      return `${year}-${month}-${day}T${time}`;
    }

    return value.replace(' ', 'T');
  }

  private loadMeasurement(): void {
    this.loadingMeasurement.set(true);
    this.tankService
      .getLastMeasurement()
      .pipe(finalize(() => this.loadingMeasurement.set(false)))
      .subscribe({
        next: (measurement) => this.measurement.set(measurement),
      });
  }

  private loadAdminData(): void {
    this.loadingAdmin.set(true);
    this.adminError.set('');
    forkJoin({
      configuration: this.adminService.getTankConfiguration(),
      extremes: this.adminService.getTankExtremes(),
      dailyExtremes: this.adminService.getFiveDayExtremes(),
      pendingTelegrams: this.adminService.getPendingTelegramRegistrations(),
    })
      .pipe(finalize(() => this.loadingAdmin.set(false)))
      .subscribe({
        next: (data) => {
          this.configuration.set(data.configuration);
          this.extremes.set(data.extremes);
          this.dailyExtremes.set(data.dailyExtremes);
          this.pendingTelegrams.set(data.pendingTelegrams);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 401 || error.status === 403) {
            this.logout();
            this.loginError.set('Sua sessão expirou. Entre novamente.');
            this.loginVisible.set(true);
            return;
          }
          this.adminError.set('Não foi possível carregar os dados administrativos.');
        },
      });
  }

  private loadTankData(): void {
    forkJoin({
      extremes: this.adminService.getTankExtremes(),
      dailyExtremes: this.adminService.getFiveDayExtremes(),
    }).subscribe({
      next: (data) => {
        this.extremes.set(data.extremes);
        this.dailyExtremes.set(data.dailyExtremes);
      },
    });
  }

  private createChartPoints(
    field: 'nivelMaisAlto' | 'nivelMaisBaixo',
  ): string {
    return this.dailyExtremes()
      .map(
        (item, index) =>
          `${this.chartX(index)},${this.chartY(item[field].percentual)}`,
      )
      .join(' ');
  }
}
