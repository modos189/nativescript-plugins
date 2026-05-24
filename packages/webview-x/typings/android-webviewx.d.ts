declare namespace com {
  namespace modos189 {
    namespace webviewx {
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
