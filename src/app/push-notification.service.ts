import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type PushSubscriptionStatus = 'unsupported' | 'denied' | 'unknown' | 'subscribed';

interface VapidPublicKeyResponse {
  publicKey: string;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly http = inject(HttpClient);

  async getStatus(): Promise<PushSubscriptionStatus> {
    if (!this.isSupported()) {
      return 'unsupported';
    }
    if (Notification.permission === 'denied') {
      return 'denied';
    }
    const registration = await navigator.serviceWorker.getRegistration('/');
    return (await registration?.pushManager.getSubscription()) ? 'subscribed' : 'unknown';
  }

  async subscribe(): Promise<PushSubscriptionStatus> {
    if (!this.isSupported()) {
      throw new Error('Este navegador não oferece suporte a notificações.');
    }
    if (Notification.permission === 'denied') {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return 'denied';
    }

    const registration = await navigator.serviceWorker.register('/push-worker.js', { scope: '/' });
    const { publicKey } = await firstValueFrom(
      this.http.get<VapidPublicKeyResponse>('db/push/public-key'),
    );
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey),
      }));

    await firstValueFrom(this.http.post('db/push/subscriptions', subscription.toJSON()));
    return 'subscribed';
  }

  async sendTest(): Promise<void> {
    await firstValueFrom(this.http.post('db/admin/push/test', {}));
  }

  private isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  private urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
    const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(padded);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  }
}
