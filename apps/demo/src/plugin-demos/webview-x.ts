import { Observable, EventData, Page } from '@nativescript/core';

const DEFAULT_URL = 'https://www.google.com';

export function navigatingTo(args: EventData) {
  const page = <Page>args.object;
  page.bindingContext = new DemoModel();
}

class DemoModel extends Observable {
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
