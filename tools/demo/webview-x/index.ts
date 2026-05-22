import {} from '@modos189/nativescript-webview-x';
import { Observable } from '@nativescript/core';

const DEFAULT_URL = 'https://www.google.com';

export class WebviewDemoModel extends Observable {
  url = DEFAULT_URL;
  src = DEFAULT_URL;

  onNavigate() {
    const trimmed = (this.url || '').trim();
    if (!trimmed) return;
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    this.set('src', normalized);
    this.set('url', normalized);
  }
}
