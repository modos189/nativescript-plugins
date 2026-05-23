export * from '@nativescript-community/ui-webview/index.ios';
import { AWebView } from '@nativescript-community/ui-webview/index.ios';

export class WebViewX extends AWebView {
  static userAgentTransform: ((defaultUA: string | null) => string | null) | null = null;

  initNativeView(): void {
    super.initNativeView();
    if (WebViewX.userAgentTransform) {
      const newUA = WebViewX.userAgentTransform(null);
      if (newUA !== null && this.nativeViewProtected) {
        this.nativeViewProtected.customUserAgent = newUA;
      }
    }
  }

  getUserAgentOverride(): string | null {
    return this.nativeViewProtected?.customUserAgent ?? null;
  }

  setUserAgentOverride(ua: string | null): void {
    if (this.nativeViewProtected) {
      this.nativeViewProtected.customUserAgent = ua || null;
    }
  }
}
