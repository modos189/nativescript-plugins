import { EventData, Page } from '@nativescript/core';
import { WebviewDemoModel } from '@demo/shared';

export function navigatingTo(args: EventData) {
  const page = <Page>args.object;
  page.bindingContext = new WebviewDemoModel();
}
