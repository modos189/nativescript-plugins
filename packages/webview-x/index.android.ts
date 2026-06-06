export * from '@nativescript-community/ui-webview/index.android';
import { AWebView, autoInjectJSBridgeProperty, supportPopupsProperty } from '@nativescript-community/ui-webview/index.android';
import { webViewBridge } from '@nativescript-community/ui-webview/nativescript-webview-bridge-loader';
import { File, Property } from '@nativescript/core';

const POPUP_NAVIGATE_EVENT = 'popupNavigate';

interface DocumentStartScript {
  /** Wrapped JS source registered via WebViewCompat.addDocumentStartJavaScript */
  code: string;
  /** Handle to the registered script, bound to a specific native WebView instance */
  handler: androidx.webkit.WebViewCompat.ScriptHandler | null;
}

/**
 * Whether the current WebView provider supports WebViewCompat.addDocumentStartJavaScript.
 * Gated by the WebView provider version, not the Android API level, so the check is deferred
 * to first use rather than evaluated at module load time. Cached for the app lifetime since
 * the provider version cannot change without a restart.
 */
let _documentStartScriptSupported: boolean | undefined;
function isDocumentStartScriptSupported(): boolean {
  if (_documentStartScriptSupported === undefined) {
    try {
      _documentStartScriptSupported = androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.DOCUMENT_START_SCRIPT);
    } catch {
      _documentStartScriptSupported = false;
    }
    if (!_documentStartScriptSupported) {
      console.warn('WebViewX: DOCUMENT_START_SCRIPT not supported by the installed WebView provider; autoLoadJavaScriptFile will fall back to onPageFinished injection.');
    }
  }
  return _documentStartScriptSupported;
}

/**
 * Wrap script so its body runs at DOMContentLoaded, mirroring iOS WKUserScript's
 * atDocumentEnd timing. Listeners fire in registration order, so script order is preserved.
 */
function wrapDocumentStartScript(code: string): string {
  return `(function(){var f=function(){\n${code}\n};if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',f);}else{f();}})();`;
}

/**
 * Origin rules limiting where document-start scripts are injected. Defaults to all origins.
 */
export const documentStartScriptAllowedOriginsProperty = new Property<WebViewX, string[]>({
  name: 'documentStartScriptAllowedOrigins',
  defaultValue: ['*'],
  valueConverter(value) {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => !!origin);
    }
    return ['*'];
  },
});

export class WebViewX extends AWebView {
  static get popupNavigateEvent() {
    return POPUP_NAVIGATE_EVENT;
  }

  public documentStartScriptAllowedOrigins: string[];

  private _popupClient: com.modos189.webviewx.PopupWebChromeClient | null = null;
  private _localResourceClient: com.modos189.webviewx.LocalResourceWebViewClient | null = null;

  /** Scripts injected at document start, in registration order */
  private _documentStartScripts = new Map<string, DocumentStartScript>();

  /** Handle to the ui-webview bridge registered as a document-start script */
  private _bridgeScriptHandler: androidx.webkit.WebViewCompat.ScriptHandler | null = null;

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

    // ScriptHandlers are bound to a specific WebView instance - re-register on the
    // (re)created native view so document-start scripts survive view recycling
    this._reRegisterAllDocumentStartScripts();
  }

  disposeNativeView(): void {
    // Handlers belong to the native view being destroyed; drop them
    this._bridgeScriptHandler = null;
    for (const entry of this._documentStartScripts.values()) {
      entry.handler = null;
    }
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

  /**
   * Auto-inject a JS file at document start on every navigation (parity with iOS WKUserScript),
   * instead of the base class's asynchronous injection on onPageFinished.
   * Falls back to the base behaviour on WebViews without DOCUMENT_START_SCRIPT support.
   */
  autoLoadJavaScriptFile(resourceName: string, filepath: string): void {
    if (!isDocumentStartScriptSupported()) {
      super.autoLoadJavaScriptFile(resourceName, filepath);
      return;
    }

    const resolved = (this as any).resolveLocalResourceFilePath(filepath) as string | void;
    if (!resolved) {
      super.autoLoadJavaScriptFile(resourceName, filepath);
      return;
    }

    const scriptCode = File.fromPath(resolved).readTextSync();
    const entry: DocumentStartScript = {
      code: wrapDocumentStartScript(scriptCode),
      handler: null,
    };

    // Re-registering the same name mirrors WKUserScript remove+append
    this._removeDocumentStartScript(resourceName);
    this._documentStartScripts.set(resourceName, entry);
    this._registerDocumentStartScript(resourceName, entry);
  }

  removeAutoLoadJavaScriptFile(resourceName: string): void {
    this._removeDocumentStartScript(resourceName);
    // Also clear any fallback entry stored by the base implementation
    super.removeAutoLoadJavaScriptFile(resourceName);
  }

  private _registerDocumentStartScript(resourceName: string, entry: DocumentStartScript): void {
    const nv = this.nativeViewProtected;
    if (!nv) return;
    const wv = nv as unknown as android.webkit.WebView;
    entry.handler = androidx.webkit.WebViewCompat.addDocumentStartJavaScript(wv, entry.code, this._buildOriginRules());
  }

  /**
   * Register the ui-webview bridge as a document-start script so window.nsWebViewBridge
   * exists before any page script. The androidWebViewBridge Java interface (added via
   * addJavascriptInterface) is available from the very start of the document, so the bridge
   * has no blocking dependency and must NOT be wrapped in a DOMContentLoaded guard.
   */
  private _registerBridgeDocumentStartScript(): void {
    const nv = this.nativeViewProtected;
    if (!nv || !this.autoInjectJSBridge || !isDocumentStartScriptSupported()) {
      return;
    }
    const wv = nv as unknown as android.webkit.WebView;
    this._bridgeScriptHandler = androidx.webkit.WebViewCompat.addDocumentStartJavaScript(wv, webViewBridge, this._buildOriginRules());
  }

  private _removeBridgeDocumentStartScript(): void {
    if (this._bridgeScriptHandler) {
      try {
        this._bridgeScriptHandler.remove();
      } catch {
        // handler already invalid (e.g. native view gone) - ignore
      }
      this._bridgeScriptHandler = null;
    }
  }

  /**
   * (Re)register the bridge followed by all user scripts in registration order, so the bridge
   * always runs first. Safe to call when handlers are already null (e.g. after view recycling)
   */
  private _reRegisterAllDocumentStartScripts(): void {
    if (!this.nativeViewProtected || !isDocumentStartScriptSupported()) {
      return;
    }

    this._removeBridgeDocumentStartScript();
    for (const entry of this._documentStartScripts.values()) {
      if (entry.handler) {
        try {
          entry.handler.remove();
        } catch {
          // ignore
        }
        entry.handler = null;
      }
    }

    this._registerBridgeDocumentStartScript();
    for (const [name, entry] of this._documentStartScripts) {
      this._registerDocumentStartScript(name, entry);
    }
  }

  private _removeDocumentStartScript(resourceName: string): void {
    const entry = this._documentStartScripts.get(resourceName);
    if (!entry) return;
    if (entry.handler) {
      try {
        entry.handler.remove();
      } catch {
        // handler already invalid (e.g. native view gone) - ignore
      }
      entry.handler = null;
    }
    this._documentStartScripts.delete(resourceName);
  }

  private _buildOriginRules(): java.util.Set<string> {
    const set = new java.util.HashSet<string>();
    const origins = this.documentStartScriptAllowedOrigins || ['*'];
    for (const origin of origins) {
      set.add(origin);
    }
    return set;
  }

  [documentStartScriptAllowedOriginsProperty.setNative](): void {
    // Re-register the bridge and all user scripts so the new origin rules take effect
    this._reRegisterAllDocumentStartScripts();
  }

  [autoInjectJSBridgeProperty.setNative](): void {
    // Toggling the bridge re-registers everything (the bridge is only added when enabled)
    this._reRegisterAllDocumentStartScripts();
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

documentStartScriptAllowedOriginsProperty.register(WebViewX);
