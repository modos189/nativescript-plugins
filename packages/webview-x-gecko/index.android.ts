import { Application, View, Property, booleanConverter } from '@nativescript/core';

let geckoRuntime: org.mozilla.geckoview.GeckoRuntime | null = null;

function getRuntime(): org.mozilla.geckoview.GeckoRuntime {
  if (!geckoRuntime) {
    geckoRuntime = org.mozilla.geckoview.GeckoRuntime.create(Application.android.context);
  }
  return geckoRuntime;
}

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

export class WebViewX extends View {
  nativeViewProtected!: org.mozilla.geckoview.GeckoView;
  private _session: org.mozilla.geckoview.GeckoSession | null = null;
  src!: string;
  debugMode!: boolean;

  createNativeView(): org.mozilla.geckoview.GeckoView {
    const runtime = getRuntime();
    const session = new org.mozilla.geckoview.GeckoSession();
    session.open(runtime);
    this._session = session;
    const geckoView = new org.mozilla.geckoview.GeckoView(this._context);
    geckoView.setSession(session);
    return geckoView;
  }

  disposeNativeView(): void {
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
    getRuntime().getSettings().setRemoteDebuggingEnabled(!!value);
  }
}

srcProperty.register(WebViewX);
debugModeProperty.register(WebViewX);
