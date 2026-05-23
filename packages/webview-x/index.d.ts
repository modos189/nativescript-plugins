export * from '@nativescript-community/ui-webview';
import { AWebView } from '@nativescript-community/ui-webview';

export declare class WebViewX extends AWebView {
  /**
   * Set once before any instance is created; applied automatically during native view init before the first URL loads.
   * Receives the platform default UA (string on Android WebView, null on iOS/GeckoView where it is unavailable synchronously).
   * Return the desired UA string, or null to leave the platform default unchanged.
   */
  static userAgentTransform: ((defaultUA: string | null) => string | null) | null;
  getUserAgentOverride(): string | null;
  setUserAgentOverride(ua: string | null): void;
  /** Android system WebView only: returns the device default UA string (unaffected by any override). */
  getDefaultUserAgent(): string;
}
