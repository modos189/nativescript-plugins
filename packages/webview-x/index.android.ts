export * from '@nativescript-community/ui-webview/index.android';
import { AWebView, supportPopupsProperty } from '@nativescript-community/ui-webview/index.android';

export class WebViewX extends AWebView {
  static userAgentTransform: ((defaultUA: string | null) => string | null) | null = null;

  private _popupClient: com.modos189.webviewx.PopupWebChromeClient | null = null;
  private _userAgentOverride: string | null = null;

  initNativeView(): void {
    super.initNativeView();

    const nv = this.nativeViewProtected;
    if (!nv) return;

    const wv = nv as unknown as android.webkit.WebView;

    if (WebViewX.userAgentTransform) {
      const defaultUA = android.webkit.WebSettings.getDefaultUserAgent(this._context);
      const newUA = WebViewX.userAgentTransform(defaultUA);
      if (newUA !== null) {
        wv.getSettings().setUserAgentString(newUA);
        this._userAgentOverride = newUA;
      }
    }

    const existing = wv.getWebChromeClient();
    // this._context is the Activity context — view.getContext() is unreliable in NativeScript
    this._popupClient = new com.modos189.webviewx.PopupWebChromeClient(existing, true, this._context);
    wv.setWebChromeClient(this._popupClient);

    const settings = wv.getSettings();
    // Required for onCreateWindow to fire
    settings.setJavaScriptCanOpenWindowsAutomatically(true);
    settings.setSupportMultipleWindows(true);
  }

  disposeNativeView(): void {
    this._popupClient = null;
    super.disposeNativeView();
  }

  getUserAgentOverride(): string | null {
    return this._userAgentOverride;
  }

  setUserAgentOverride(ua: string | null): void {
    this._userAgentOverride = ua || null;
    const wv = this.nativeViewProtected as unknown as android.webkit.WebView;
    if (wv) wv.getSettings().setUserAgentString(this._userAgentOverride);
  }

  getDefaultUserAgent(): string {
    return android.webkit.WebSettings.getDefaultUserAgent(this._context);
  }

  [supportPopupsProperty.setNative](value: boolean): void {
    const nv = this.nativeViewProtected;
    if (!nv) return;
    const settings = (nv as unknown as android.webkit.WebView).getSettings();
    settings.setJavaScriptCanOpenWindowsAutomatically(value);
    settings.setSupportMultipleWindows(value);
    this._popupClient?.setSupportPopups(value);
  }
}
