export * from '@nativescript-community/ui-webview/index.android';
import { AWebView, supportPopupsProperty } from '@nativescript-community/ui-webview/index.android';

const POPUP_NAVIGATE_EVENT = 'popupNavigate';

export class WebViewX extends AWebView {
  static get popupNavigateEvent() {
    return POPUP_NAVIGATE_EVENT;
  }

  private _popupClient: com.modos189.webviewx.PopupWebChromeClient | null = null;
  private _localResourceClient: com.modos189.webviewx.LocalResourceWebViewClient | null = null;

  _onPopupNavigate(url: string): boolean {
    const args: any = {
      eventName: POPUP_NAVIGATE_EVENT,
      url,
      cancel: false,
    };
    this.notify(args);
    return args.cancel === true;
  }

  initNativeView(): void {
    super.initNativeView();

    const nv = this.nativeViewProtected;
    if (!nv) return;

    const wv = nv as unknown as android.webkit.WebView;

    // shouldInterceptRequest is called on Chromium's network thread; NativeScript cannot
    // safely dispatch to V8 from there — wrap the NS client so it runs entirely in Java.
    const nsClient = (wv as any).getWebViewClient() as android.webkit.WebViewClient;
    this._localResourceClient = new com.modos189.webviewx.LocalResourceWebViewClient(nsClient);
    wv.setWebViewClient(this._localResourceClient);

    const existing = wv.getWebChromeClient();
    this._popupClient = new com.modos189.webviewx.PopupWebChromeClient(existing, true, this._context);
    const interceptor = new com.modos189.webviewx.PopupWebChromeClient.PopupUrlInterceptor({
      shouldHandleExternally: (url: string) => {
        return this._onPopupNavigate(url != null ? '' + url : '');
      },
    });
    this._popupClient.setUrlInterceptor(interceptor);
    wv.setWebChromeClient(this._popupClient);

    const settings = wv.getSettings();
    settings.setJavaScriptCanOpenWindowsAutomatically(true);
    settings.setSupportMultipleWindows(true);
  }

  disposeNativeView(): void {
    this._localResourceClient = null;
    this._popupClient = null;
    super.disposeNativeView();
  }

  registerLocalResource(resourceName: string, path: string): void {
    super.registerLocalResource(resourceName, path);
    if (this._localResourceClient) {
      const filepath = (this as any).resolveLocalResourceFilePath(path);
      if (filepath) {
        const fixedName = (this as any).fixLocalResourceName(resourceName);
        this._localResourceClient.registerResource(fixedName, filepath);
      }
    }
  }

  unregisterLocalResource(resourceName: string): void {
    super.unregisterLocalResource(resourceName);
    if (this._localResourceClient) {
      this._localResourceClient.unregisterResource((this as any).fixLocalResourceName(resourceName));
    }
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
