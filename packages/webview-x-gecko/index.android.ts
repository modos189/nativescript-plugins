import { Application, View, Property, booleanConverter } from '@nativescript/core';

// Explicit type annotation required to break circular inference with [xProperty.setNative]
export const srcProperty: Property<WebViewX, string> = new Property<WebViewX, string>({
  name: 'src',
  defaultValue: '',
});

export const debugModeProperty: Property<WebViewX, boolean> = new Property<WebViewX, boolean>({
  name: 'debugMode',
  defaultValue: false,
  valueConverter: booleanConverter,
});

export const supportPopupsProperty: Property<WebViewX, boolean> = new Property<WebViewX, boolean>({
  name: 'supportPopups',
  defaultValue: true,
  valueConverter: booleanConverter,
});

export class WebViewX extends View {
  nativeViewProtected!: org.mozilla.geckoview.GeckoView;
  private _session: org.mozilla.geckoview.GeckoSession | null = null;
  private _popupHelper: com.modos189.webviewxgecko.GeckoPopupHelper | null = null;
  src!: string;
  debugMode!: boolean;
  supportPopups!: boolean;

  createNativeView(): org.mozilla.geckoview.GeckoView {
    const runtime = com.modos189.webviewxgecko.GeckoPopupHelper.getRuntime(Application.android.context);
    const session = new org.mozilla.geckoview.GeckoSession();
    // GeckoPopupHelper sets the NavigationDelegate and manages popup windows.
    // this._context is the Activity context — required for Dialog creation.
    this._popupHelper = new com.modos189.webviewxgecko.GeckoPopupHelper(session, this._context, true);
    session.open(runtime);
    this._session = session;
    const geckoView = new org.mozilla.geckoview.GeckoView(this._context);
    geckoView.setSession(session);
    return geckoView;
  }

  disposeNativeView(): void {
    this._popupHelper = null;
    if (this._session) {
      this._session.close();
      this._session = null;
    }
    super.disposeNativeView();
  }

  [srcProperty.setNative](value: string): void {
    if (value && this._session) {
      this._session.loadUri(value);
    }
  }

  [debugModeProperty.setNative](value: boolean): void {
    com.modos189.webviewxgecko.GeckoPopupHelper.setRemoteDebuggingEnabled(!!value);
  }

  [supportPopupsProperty.setNative](value: boolean): void {
    this._popupHelper?.setSupportPopups(!!value);
  }
}

srcProperty.register(WebViewX);
debugModeProperty.register(WebViewX);
supportPopupsProperty.register(WebViewX);
