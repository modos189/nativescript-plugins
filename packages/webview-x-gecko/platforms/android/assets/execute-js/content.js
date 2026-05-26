'use strict';

browser.runtime.onMessage.addListener((data) => {
  if (data.inject === undefined) {
    return Promise.resolve();
  }
  try {
    // wrappedJSObject bypasses Xray vision so eval runs in the page's JS context
    const result = window.wrappedJSObject.eval(data.inject);
    let serialized;
    if (result === undefined) {
      serialized = 'null';
    } else {
      try {
        serialized = JSON.stringify(result);
        if (serialized === undefined) serialized = 'null';
      } catch (_e) {
        serialized = String(result);
      }
    }
    return Promise.resolve({ id: data.id, result: serialized });
  } catch (e) {
    return Promise.resolve({ id: data.id, error: e.toString() });
  }
});

// Forward nsWebViewBridge.emit() calls from the page to the native layer.
// The bridge JS (injected on loadFinished) dispatches this CustomEvent on document
// when window.nsWebViewBridge.emit() is called.
document.addEventListener('__ns_bridge_emit__', (event) => {
  browser.runtime.sendMessage({
    type: 'bridge-emit',
    eventName: event.detail.eventName,
    data: event.detail.data,
  });
});
