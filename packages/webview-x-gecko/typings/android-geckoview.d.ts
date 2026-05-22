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
        setProgressDelegate(delegate: any): void;
        setContentDelegate(delegate: any): void;
      }
      class GeckoView extends android.view.View {
        constructor(context: android.content.Context);
        setSession(session: GeckoSession): void;
        getSession(): GeckoSession;
      }
    }
  }
}
