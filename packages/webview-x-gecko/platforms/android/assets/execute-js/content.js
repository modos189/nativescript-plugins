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
