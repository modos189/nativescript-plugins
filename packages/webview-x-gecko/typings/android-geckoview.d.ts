declare namespace org {
  namespace mozilla {
    namespace geckoview {
      class GeckoRuntime {
        static create(context: android.content.Context): GeckoRuntime;
        getSettings(): GeckoRuntimeSettings;
      }
      class GeckoRuntimeSettings {
        setJavaScriptEnabled(enabled: boolean): void;
        setWebManifestEnabled(enabled: boolean): void;
        setConsoleOutputEnabled(enabled: boolean): void;
        setRemoteDebuggingEnabled(enabled: boolean): void;
      }
      class GeckoSession {
        constructor();
        open(runtime: GeckoRuntime): void;
        close(): void;
        loadUri(uri: string): void;
        setNavigationDelegate(delegate: any): void;
        setProgressDelegate(delegate: com.modos189.webviewxgecko.GeckoDelegates.ProgressDelegate | null): void;
        setContentDelegate(delegate: com.modos189.webviewxgecko.GeckoDelegates.ContentDelegate | null): void;
      }
      class GeckoView extends android.view.View {
        constructor(context: android.content.Context);
        setSession(session: GeckoSession): void;
        getSession(): GeckoSession;
      }
    }
  }
}

declare namespace com {
  namespace modos189 {
    namespace webviewxgecko {
      class GeckoPopupHelper {
        constructor(session: org.mozilla.geckoview.GeckoSession, context: android.content.Context, supportPopups: boolean);
        setUrlInterceptor(interceptor: GeckoPopupHelper.PopupUrlInterceptor): void;
        setSupportPopups(value: boolean): void;
        static getRuntime(context: android.content.Context): org.mozilla.geckoview.GeckoRuntime;
        static setRemoteDebuggingEnabled(enabled: boolean): void;
      }
      namespace GeckoPopupHelper {
        // Constructor accepts an object with method implementations (NativeScript interface pattern)
        class PopupUrlInterceptor {
          constructor(impl: { shouldHandleExternally(url: string): boolean });
        }
      }

      namespace GeckoDelegates {
        // Constructors accept objects with method implementations (NativeScript interface pattern)
        class ProgressListener {
          constructor(impl: { onPageStart(url: string): void; onPageStop(success: boolean): void; onProgressChange(progress: number): void });
        }
        class ContentListener {
          constructor(impl: { onTitleChange(title: string): void });
        }
        class ProgressDelegate {
          constructor(listener: ProgressListener);
        }
        class ContentDelegate {
          constructor(listener: ContentListener);
        }
      }

      class GeckoJsBridge {
        static getInstance(): GeckoJsBridge;
        nextId(): string;
        setup(runtime: org.mozilla.geckoview.GeckoRuntime): void;
        executeScript(id: string, code: string, callback: GeckoJsBridge.JsCallback): void;
        addBridgeListener(listener: GeckoJsBridge.BridgeEventListener): void;
        removeBridgeListener(listener: GeckoJsBridge.BridgeEventListener): void;
      }
      namespace GeckoJsBridge {
        class JsCallback {
          constructor(impl: { onResult(jsonResult: string): void; onError(error: string): void });
        }
        class BridgeEventListener {
          constructor(impl: { onBridgeEvent(eventName: string, dataJson: string): void });
        }
      }
    }
  }
}
