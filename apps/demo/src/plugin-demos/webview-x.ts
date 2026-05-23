import { EventData, Page, isAndroid } from '@nativescript/core';
import { WebviewDemoModel } from '@demo/shared';
import { WebViewX } from '@modos189/nativescript-webview-x';

function sanitizeUAForGoogleAuth(ua: string): string {
  let result = ua.replace('; wv', '');
  const match = result.match(/Chrome\/(\d+)\.0\.0\.0/);
  if (match) result = result.replace(/Chrome\/(\d+)\.0\.0\.0/, `Chrome/${match[1]}.0.0.1`);
  return result;
}

if (isAndroid) {
  WebViewX.userAgentTransform = sanitizeUAForGoogleAuth;
}

export function navigatingTo(args: EventData) {
  const page = <Page>args.object;
  page.bindingContext = new WebviewDemoModel();
}
