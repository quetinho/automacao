import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import {
  debounceTime,
  distinctUntilChanged,
  finalize,
  forkJoin,
  Subject,
} from 'rxjs';

import {
  AdminService,
  DailyTankExtremes,
  NetworkDevice,
  NetworkHistory,
  TankConfiguration,
  TankExtremes,
  TankHistoryMeasurement,
  TelegramRegistration,
  UnknownNetworkConnection,
} from './admin.service';
import { AuthService } from './auth.service';
import {
  PushNotificationService,
  PushSubscriptionStatus,
} from './push-notification.service';
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
  private readonly pushNotificationService = inject(PushNotificationService);

  protected readonly measurement = signal<TankMeasurement | null>(null);
  protected readonly loadingMeasurement = signal(true);
  protected readonly loginVisible = signal(false);
  protected readonly authenticated = signal(this.authService.isLoggedIn);
  protected readonly loginError = signal('');
  protected readonly usuario = signal('');
  protected readonly senha = signal('');
  protected readonly alertFormError = signal('');
  protected readonly alertFormMessage = signal('');
  protected readonly enablingPushNotifications = signal(false);
  protected readonly pushNotificationStatus =
    signal<PushSubscriptionStatus>('unknown');

  protected readonly loadingAdmin = signal(false);
  protected readonly savingConfiguration = signal(false);
  protected readonly sendingPushTest = signal(false);
  protected readonly adminError = signal('');
  protected readonly adminMessage = signal('');
  protected readonly configuration = signal<TankConfiguration>({
    distanciaCheio: 34.11,
    distanciaVazio: 113,
  });
  protected readonly extremes = signal<TankExtremes | null>(null);
  protected readonly dailyExtremes = signal<DailyTankExtremes[]>([]);
  protected readonly history24Hours = signal<TankHistoryMeasurement[]>([]);
  protected readonly pendingTelegrams = signal<TelegramRegistration[]>([]);
  protected readonly savingTelegramId = signal<number | null>(null);
  protected readonly adminSection = signal<'tank' | 'network'>('tank');
  protected readonly networkDevices = signal<NetworkDevice[]>([]);
  protected readonly networkHistory = signal<NetworkHistory[]>([]);
  protected readonly unknownNetworkConnections = signal<
    UnknownNetworkConnection[]
  >([]);
  protected readonly loadingNetwork = signal(false);
  protected readonly deviceDialogVisible = signal(false);
  protected readonly savingDevice = signal(false);
  protected readonly deviceForm = signal<Partial<NetworkDevice>>({});
  private buscaSubject = new Subject<string>();
  protected nomeBusca = signal('');

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
  protected readonly history24HourPoints = computed(() =>
    this.history24Hours()
      .map(
        (item, index) =>
          `${this.historyChartX(index)},${this.chartY(item.percentual)}`,
      )
      .join(' '),
  );

  ngOnInit(): void {
    this.loadMeasurement();
    this.pushNotificationService
      .getStatus()
      .then((status) => this.pushNotificationStatus.set(status));
    if (this.authenticated()) {
      this.loadAdminData();
    }
    this.buscaSubject
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe((nome) => this.loadNetworkHistorico(nome));
  }

  protected openLogin(): void {
    this.loginError.set('');
    this.loginVisible.set(true);
  }

  protected enablePushNotifications(): void {
    this.alertFormError.set('');
    this.alertFormMessage.set('');
    this.enablingPushNotifications.set(true);
    this.pushNotificationService
      .subscribe()
      .then((status) => {
        this.pushNotificationStatus.set(status);
        this.alertFormMessage.set(
          status === 'subscribed'
            ? 'Notificações ativadas neste dispositivo.'
            : 'As notificações estão bloqueadas neste navegador.',
        );
      })
      .catch((error: Error) => this.alertFormError.set(error.message))
      .finally(() => this.enablingPushNotifications.set(false));
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

  protected sendPushTest(): void {
    this.adminError.set('');
    this.adminMessage.set('');
    this.sendingPushTest.set(true);
    this.pushNotificationService
      .sendTest()
      .then(() =>
        this.adminMessage.set(
          'Notificação de teste enviada aos dispositivos inscritos.',
        ),
      )
      .catch((error: HttpErrorResponse) =>
        this.adminError.set(
          error.error?.message ??
            'Não foi possível enviar a notificação de teste.',
        ),
      )
      .finally(() => this.sendingPushTest.set(false));
  }

  protected selectAdminSection(section: 'tank' | 'network'): void {
    this.adminSection.set(section);
    if (section === 'network') {
      this.loadNetworkData();
    }
  }

  protected openDeviceDialog(device?: NetworkDevice): void {
    this.deviceForm.set(
      device
        ? { ...device }
        : { deviceNome: '', macAddress: '', ipAddress: '' },
    );
    this.deviceDialogVisible.set(true);
  }

  protected updateDeviceField(
    field: 'deviceNome' | 'macAddress' | 'ipAddress',
    value: string,
  ): void {
    this.deviceForm.update((device) => ({ ...device, [field]: value }));
  }

  protected saveDevice(): void {
    const device = this.deviceForm();
    if (!device.deviceNome?.trim() || !device.macAddress?.trim()) {
      this.adminError.set('Preencha nome, MAC e IP do dispositivo.');
      return;
    }
    this.savingDevice.set(true);
    this.adminError.set('');
    const request = device.id
      ? this.adminService.updateNetworkDevice(device as NetworkDevice)
      : this.adminService.createNetworkDevice({
          deviceNome: device.deviceNome,
          macAddress: device.macAddress,
        });
    request.pipe(finalize(() => this.savingDevice.set(false))).subscribe({
      next: (result) => {
        this.adminMessage.set(result.message);
        this.deviceDialogVisible.set(false);
        this.loadNetworkData();
      },
      error: (error: HttpErrorResponse) =>
        this.adminError.set(
          error.error?.message ?? 'Não foi possível salvar o dispositivo.',
        ),
    });
  }

  protected deleteDevice(device: NetworkDevice): void {
    if (!window.confirm(`Remover o dispositivo ${device.deviceNome}?`)) {
      return;
    }
    this.adminError.set('');
    this.adminService.deleteNetworkDevice(device.id).subscribe({
      next: (result) => {
        this.adminMessage.set(result.message);
        this.loadNetworkData();
      },
      error: (error: HttpErrorResponse) =>
        this.adminError.set(
          error.error?.message ?? 'Não foi possível remover o dispositivo.',
        ),
    });
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

  protected historyChartX(index: number): number {
    const count = this.history24Hours().length;
    return count <= 1 ? 350 : 55 + (index * 600) / (count - 1);
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
      history24Hours: this.adminService.get24HourHistory(),
      pendingTelegrams: this.adminService.getPendingTelegramRegistrations(),
    })
      .pipe(finalize(() => this.loadingAdmin.set(false)))
      .subscribe({
        next: (data) => {
          this.configuration.set(data.configuration);
          this.extremes.set(data.extremes);
          this.dailyExtremes.set(data.dailyExtremes);
          this.history24Hours.set(data.history24Hours);
          this.pendingTelegrams.set(data.pendingTelegrams);
        },
        error: (error: HttpErrorResponse) => {
          console.error('=== ERRO NO loadAdminData ===');
          console.error('Status:', error.status);
          console.error('Status Text:', error.statusText);
          console.error('Mensagem:', error.message);
          console.error('Error:', error.error);
          console.error('Headers:', error.headers);
          console.error('URL:', error.url);

          // Se for erro de rede (CORS, offline, etc)
          if (error.status === 0) {
            console.error(
              'Erro de rede/CORS - verifique conectividade ou configuração CORS',
            );
            this.adminError.set('Erro de conexão com o servidor.');
            return;
          }

          if (error.status === 401 || error.status === 403) {
            this.logout();
            this.loginError.set('Sua sessão expirou. Entre novamente.');
            this.loginVisible.set(true);
            return;
          }

          // Log do corpo da resposta se existir
          if (error.error) {
            console.error(
              'Detalhes do erro:',
              JSON.stringify(error.error, null, 2),
            );
          }

          this.adminError.set(
            'Não foi possível carregar os dados administrativos.',
          );

          /*
          if (error.status === 401 || error.status === 403) {
            this.logout();
            this.loginError.set('Sua sessão expirou. Entre novamente.');
            this.loginVisible.set(true);
            return;
          }
          this.adminError.set('Não foi possível carregar os dados administrativos.');
          */
        },
      });
  }

  private loadTankData(): void {
    forkJoin({
      extremes: this.adminService.getTankExtremes(),
      dailyExtremes: this.adminService.getFiveDayExtremes(),
      history24Hours: this.adminService.get24HourHistory(),
    }).subscribe({
      next: (data) => {
        this.extremes.set(data.extremes);
        this.dailyExtremes.set(data.dailyExtremes);
        this.history24Hours.set(data.history24Hours);
      },
    });
  }

  private loadNetworkData(): void {
    this.loadingNetwork.set(true);
    forkJoin({
      devices: this.adminService.getNetworkDevices(),
      history: this.adminService.getNetworkHistory(''),
      unknownConnections: this.adminService.getUnknownNetworkConnections(),
    })
      .pipe(finalize(() => this.loadingNetwork.set(false)))
      .subscribe({
        next: (data) => {
          this.networkDevices.set(data.devices);
          this.networkHistory.set(data.history);
          this.unknownNetworkConnections.set(data.unknownConnections);
        },
        error: (error: HttpErrorResponse) =>
          this.adminError.set(
            error.error?.message ??
              'Não foi possível carregar o monitoramento de rede.',
          ),
      });
  }

  private loadNetworkHistorico(nome: string = ''): void {
    this.adminService
      .getNetworkHistory(nome)
      .pipe()
      .subscribe({
        next: (data) => {
          console.log('data', data);
          this.networkHistory.set(data);
        },
        error: (error: HttpErrorResponse) =>
          this.adminError.set(
            error.error?.message ??
              'Não foi possível carregar o monitoramento de rede.',
          ),
      });
  }
  onBuscar(nome: string) {
    this.buscaSubject.next(nome);
  }

  private createChartPoints(field: 'nivelMaisAlto' | 'nivelMaisBaixo'): string {
    return this.dailyExtremes()
      .map(
        (item, index) =>
          `${this.chartX(index)},${this.chartY(item[field].percentual)}`,
      )
      .join(' ');
  }
}
