export * from '@nativescript-community/ui-webview';
import { AWebView } from '@nativescript-community/ui-webview';

export declare class WebViewX extends AWebView {
  static readonly popupNavigateEvent: string;
  registerLocalResource(resourceName: string, path: string): void;
  unregisterLocalResource(resourceName: string): void;
}
