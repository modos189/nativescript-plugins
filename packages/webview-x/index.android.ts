export * from '@nativescript-community/ui-webview/index.android';
import { AWebView, supportPopupsProperty } from '@nativescript-community/ui-webview/index.android';

const POPUP_NAVIGATE_EVENT = 'popupNavigate';

export class WebViewX extends AWebView {
  static get popupNavigateEvent() {
    return POPUP_NAVIGATE_EVENT;
  }

  private _popupClient: com.modos189.webviewx.PopupWebChromeClient | null = null;

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
