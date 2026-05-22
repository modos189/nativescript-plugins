import { Observable, EventData, Page } from '@nativescript/core';
import { DemoSharedWebviewX } from '@demo/shared';
import {} from '@modos189/webview-x';

export function navigatingTo(args: EventData) {
  const page = <Page>args.object;
  page.bindingContext = new DemoModel();
}

export class DemoModel extends DemoSharedWebviewX {}
