import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';

import { AuthService } from './auth.service';
import { TankMeasurement, TankService } from './tank.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, DatePipe, FormsModule, ButtonModule, DialogModule, InputTextModule, PasswordModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly tankService = inject(TankService);

  protected readonly measurement = signal<TankMeasurement | null>(null);
  protected readonly loadingMeasurement = signal(true);
  protected readonly loginVisible = signal(false);
  protected readonly authenticated = signal(this.authService.isLoggedIn);
  protected readonly loginError = signal('');
  protected readonly usuario = signal('');
  protected readonly senha = signal('');

  protected readonly waterLevel = computed(() => {
    const value = this.measurement()?.capacityPercent ?? 0;
    return Math.max(0, Math.min(100, value));
  });

  ngOnInit(): void {
    this.tankService.getLastMeasurement().subscribe({
      next: (measurement) => this.measurement.set(measurement),
      complete: () => this.loadingMeasurement.set(false),
    });
  }

  protected openLogin(): void {
    this.loginError.set('');
    this.loginVisible.set(true);
  }

  protected login(): void {
    this.loginError.set('');

    this.authService.login({ usuario: this.usuario(), senha: this.senha() }).subscribe({
      next: () => {
        this.authenticated.set(true);
        this.loginVisible.set(false);
        this.senha.set('');
      },
      error: () => this.loginError.set('Usuario ou senha invalidos.'),
    });
  }

  protected logout(): void {
    this.authService.logout();
    this.authenticated.set(false);
  }
}
