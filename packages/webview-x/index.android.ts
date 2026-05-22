export * from '@nativescript-community/ui-webview/index.android';
import { AWebView, supportPopupsProperty } from '@nativescript-community/ui-webview/index.android';

export class WebViewX extends AWebView {
  private _popupClient: com.modos189.webviewx.PopupWebChromeClient | null = null;

  initNativeView(): void {
    super.initNativeView();

    const nv = this.nativeViewProtected;
    if (!nv) return;

    // AndroidWebView doesn't re-declare all android.webkit.WebView methods in its typings
    const wv = nv as unknown as android.webkit.WebView;

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

  [supportPopupsProperty.setNative](value: boolean): void {
    const nv = this.nativeViewProtected;
    if (!nv) return;
    const settings = (nv as unknown as android.webkit.WebView).getSettings();
    settings.setJavaScriptCanOpenWindowsAutomatically(value);
    settings.setSupportMultipleWindows(value);
    this._popupClient?.setSupportPopups(value);
  }
}
