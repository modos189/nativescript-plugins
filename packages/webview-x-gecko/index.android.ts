import { Application, View, Property, booleanConverter } from '@nativescript/core';
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

  _onLoadFinished(url: string, error?: string): void {
    if (!error) {
      try {
        this._tempSuspendSrcLoading = true;
        this.src = url;
      } finally {
        this._tempSuspendSrcLoading = false;
      }
    }
    this.notify({
      eventName: LOAD_FINISHED_EVENT,
      object: this,
      url,
      error,
    } as LoadFinishedEventData);
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

  createNativeView(): org.mozilla.geckoview.GeckoView {
    const runtime = com.modos189.webviewxgecko.GeckoPopupHelper.getRuntime(Application.android.context);
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
}

srcProperty.register(WebViewX);
debugModeProperty.register(WebViewX);
supportPopupsProperty.register(WebViewX);
userAgentProperty.register(WebViewX);
