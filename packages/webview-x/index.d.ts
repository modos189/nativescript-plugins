export * from '@nativescript-community/ui-webview';
import { AWebView } from '@nativescript-community/ui-webview';

export declare class WebViewX extends AWebView {
  static readonly popupNavigateEvent: string;
  /**
   * Android: origin rules limiting where document-start scripts are injected.
   * Defaults to ['*'] (all origins).
   */
  documentStartScriptAllowedOrigins: string[];
  registerLocalResource(resourceName: string, path: string): void;
  unregisterLocalResource(resourceName: string): void;
  autoLoadJavaScriptFile(resourceName: string, filepath: string): void;
  removeAutoLoadJavaScriptFile(resourceName: string): void;
}
