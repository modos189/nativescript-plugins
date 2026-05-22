declare namespace com {
  namespace modos189 {
    namespace webviewx {
      class PopupWebChromeClient extends android.webkit.WebChromeClient {
        constructor(delegate: android.webkit.WebChromeClient, supportPopups: boolean, activityContext: android.content.Context);
        setSupportPopups(value: boolean): void;
      }
    }
  }
}
