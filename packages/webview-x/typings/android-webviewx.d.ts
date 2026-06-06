declare namespace com {
  namespace modos189 {
    namespace webviewx {
      class LocalResourceWebViewClient extends android.webkit.WebViewClient {
        constructor(delegate: android.webkit.WebViewClient);
        registerResource(name: string, filePath: string): void;
        unregisterResource(name: string): void;
      }
      class PopupWebChromeClient extends android.webkit.WebChromeClient {
        constructor(delegate: android.webkit.WebChromeClient, supportPopups: boolean, activityContext: android.content.Context);
        setSupportPopups(value: boolean): void;
        setUrlInterceptor(interceptor: PopupWebChromeClient.PopupUrlInterceptor): void;
      }
      namespace PopupWebChromeClient {
        class PopupUrlInterceptor {
          constructor(implementation: { shouldHandleExternally(url: string): boolean });
          shouldHandleExternally(url: string): boolean;
        }
      }
    }
  }
}

declare namespace androidx {
  namespace webkit {
    class WebViewFeature {
      static DOCUMENT_START_SCRIPT: string;
      static isFeatureSupported(feature: string): boolean;
    }
    class WebViewCompat {
      static addDocumentStartJavaScript(webView: android.webkit.WebView, javaScript: string, allowedOriginRules: java.util.Set<string>): androidx.webkit.WebViewCompat.ScriptHandler;
    }
    namespace WebViewCompat {
      class ScriptHandler {
        remove(): void;
      }
    }
  }
}
