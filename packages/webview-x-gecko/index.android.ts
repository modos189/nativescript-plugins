import { Application, View, Property, booleanConverter } from '@nativescript/core';
import { geckoBridgeJs as _GECKO_BRIDGE_JS } from './gecko-bridge-loader';
import { LOAD_STARTED_EVENT, LOAD_FINISHED_EVENT, LOAD_PROGRESS_EVENT, TITLE_CHANGED_EVENT, LoadStartedEventData, LoadFinishedEventData, LoadProgressEventData, TitleChangedEventData } from './common';

export * from './common';

const POPUP_NAVIGATE_EVENT = 'popupNavigate';

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

export const userAgentProperty: Property<WebViewX, string> = new Property<WebViewX, string>({
  name: 'userAgent',
});

export const autoInjectJSBridgeProperty: Property<WebViewX, boolean> = new Property<WebViewX, boolean>({
  name: 'autoInjectJSBridge',
  defaultValue: true,
  valueConverter: booleanConverter,
});

export class WebViewX extends View {
  static get popupNavigateEvent() {
    return POPUP_NAVIGATE_EVENT;
  }

  static get loadStartedEvent() {
    return LOAD_STARTED_EVENT;
  }

  static get loadFinishedEvent() {
    return LOAD_FINISHED_EVENT;
  }

  static get loadProgressEvent() {
    return LOAD_PROGRESS_EVENT;
  }

  static get titleChangedEvent() {
    return TITLE_CHANGED_EVENT;
  }

  nativeViewProtected!: org.mozilla.geckoview.GeckoView;
  private _session: org.mozilla.geckoview.GeckoSession | null = null;
  private _popupHelper: com.modos189.webviewxgecko.GeckoPopupHelper | null = null;

  _currentUrl: string = '';
  _currentTitle: string = '';
  _tempSuspendSrcLoading: boolean = false;

  src!: string;
  debugMode!: boolean;
  supportPopups!: boolean;
  userAgent!: string;
  autoInjectJSBridge!: boolean;

  private _bridgeListener: com.modos189.webviewxgecko.GeckoJsBridge.BridgeEventListener | null = null;

  _onPopupNavigate(url: string): boolean {
    const args: any = {
      eventName: POPUP_NAVIGATE_EVENT,
      url,
      cancel: false,
    };
    this.notify(args);
    return args.cancel === true;
  }

  _onLoadStarted(url: string): void {
    this._currentUrl = url;
    this._currentTitle = ''; // reset stale title on each new navigation
    this.notify({
      eventName: LOAD_STARTED_EVENT,
      object: this,
      url,
    } as LoadStartedEventData);
  }

  async _onLoadFinished(url: string, error?: string): Promise<void> {
    if (!error) {
      try {
        this._tempSuspendSrcLoading = true;
        this.src = url;
      } finally {
        this._tempSuspendSrcLoading = false;
      }
    }
    if (!error && this.autoInjectJSBridge) {
      try {
        await this.executeJavaScript(_GECKO_BRIDGE_JS);
      } catch {
        // bridge injection is best-effort
      }
    }
    this.notify({
      eventName: LOAD_FINISHED_EVENT,
      object: this,
      url,
      error,
    } as LoadFinishedEventData);
  }

  emitToWebView(eventName: string, data: any): void {
    const code = `window.nsWebViewBridge&&nsWebViewBridge.onNativeEvent(${JSON.stringify(eventName)},${JSON.stringify(data)});`;
    this.executeJavaScript(code).catch(() => {
      // ignore — page may not have bridge
    });
  }

  onWebViewEvent(eventName: string, data: any): void {
    this.notify({ eventName, data });
  }

  _loadProgress(progress: number): void {
    this.notify({
      eventName: LOAD_PROGRESS_EVENT,
      object: this,
      url: this._currentUrl,
      progress,
    } as LoadProgressEventData);
  }

  _titleChanged(title: string): void {
    this._currentTitle = title;
    this.notify({
      eventName: TITLE_CHANGED_EVENT,
      object: this,
      url: this._currentUrl,
      title,
    } as TitleChangedEventData);
  }

  /** Returns the current page title (cached from GeckoDelegates.ContentDelegate.onTitleChange). */
  async getTitle(): Promise<string | undefined> {
    return this._currentTitle || undefined;
  }

  /**
   * Execute JavaScript in the current page's context and return the result.
   * Uses a built-in WebExtension bridge; requires GeckoView 65+.
   */
  executeJavaScript<T = any>(code: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const bridge = com.modos189.webviewxgecko.GeckoJsBridge.getInstance();
      const id = bridge.nextId();
      bridge.executeScript(
        id,
        code,
        new com.modos189.webviewxgecko.GeckoJsBridge.JsCallback({
          onResult(jsonResult: string): void {
            resolve(_parseJsResult(jsonResult) as T);
          },
          onError(error: string): void {
            reject(new Error(error));
          },
        }),
      );
    });
  }

  createNativeView(): org.mozilla.geckoview.GeckoView {
    const runtime = com.modos189.webviewxgecko.GeckoPopupHelper.getRuntime(Application.android.context);
    com.modos189.webviewxgecko.GeckoJsBridge.getInstance().setup(runtime);

    const selfRef = new WeakRef(this);
    this._bridgeListener = new com.modos189.webviewxgecko.GeckoJsBridge.BridgeEventListener({
      onBridgeEvent(eventName: string, dataJson: string): void {
        const owner = selfRef.deref();
        if (!owner) return;
        let data: any;
        try {
          data = JSON.parse(dataJson);
        } catch {
          data = dataJson;
        }
        owner.onWebViewEvent(eventName, data);
      },
    });
    com.modos189.webviewxgecko.GeckoJsBridge.getInstance().addBridgeListener(this._bridgeListener);
    const session = new org.mozilla.geckoview.GeckoSession();

    this._popupHelper = new com.modos189.webviewxgecko.GeckoPopupHelper(session, this._context, true);
    const interceptor = new com.modos189.webviewxgecko.GeckoPopupHelper.PopupUrlInterceptor({
      shouldHandleExternally: (url: string) => {
        return this._onPopupNavigate(url != null ? '' + url : '');
      },
    });
    this._popupHelper.setUrlInterceptor(interceptor);

    // GeckoDelegates are Java wrappers - NativeScript cannot proxy GeckoView interfaces directly
    // (Java 8 default methods + @UiThread annotations break the runtime DEX factory).
    session.setProgressDelegate(
      new com.modos189.webviewxgecko.GeckoDelegates.ProgressDelegate(
        new com.modos189.webviewxgecko.GeckoDelegates.ProgressListener({
          onPageStart: (url: string) => this._onLoadStarted(url),
          onPageStop: (success: boolean) => this._onLoadFinished(this._currentUrl, success ? undefined : 'load-failed'),
          onProgressChange: (progress: number) => this._loadProgress(progress),
        }),
      ),
    );

    session.setContentDelegate(
      new com.modos189.webviewxgecko.GeckoDelegates.ContentDelegate(
        new com.modos189.webviewxgecko.GeckoDelegates.ContentListener({
          onTitleChange: (title: string) => this._titleChanged(title),
        }),
      ),
    );

    session.open(runtime);
    this._session = session;
    const geckoView = new org.mozilla.geckoview.GeckoView(this._context);
    geckoView.setSession(session);
    return geckoView;
  }

  disposeNativeView(): void {
    if (this._bridgeListener) {
      com.modos189.webviewxgecko.GeckoJsBridge.getInstance().removeBridgeListener(this._bridgeListener);
      this._bridgeListener = null;
    }
    this._popupHelper = null;
    if (this._session) {
      this._session.setProgressDelegate(null);
      this._session.setContentDelegate(null);
      this._session.close();
      this._session = null;
    }
    super.disposeNativeView();
  }

  [srcProperty.setNative](value: string): void {
    if (this._tempSuspendSrcLoading) return;
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

  [userAgentProperty.setNative](value: string): void {
    (this._session as any)?.getSettings().setUserAgentOverride(value || null);
  }

  [autoInjectJSBridgeProperty.setNative](_value: boolean): void {
    // value stored as a property field; read in _onLoadFinished
  }
}

srcProperty.register(WebViewX);
debugModeProperty.register(WebViewX);
supportPopupsProperty.register(WebViewX);
userAgentProperty.register(WebViewX);
autoInjectJSBridgeProperty.register(WebViewX);

function _parseJsResult(jsonString: string | null | undefined): unknown {
  if (!jsonString || jsonString === 'null') return null;
  try {
    return JSON.parse(jsonString);
  } catch {
    return jsonString;
  }
}
