'use strict';

// "native" matches the name passed to extension.setMessageDelegate(bridge, "native")
const port = browser.runtime.connectNative('native');

async function sendMessageToTab(message) {
  const tabs = await browser.tabs.query({});
  if (tabs.length === 0) {
    throw new Error('no tabs available');
  }
  return await browser.tabs.sendMessage(tabs[tabs.length - 1].id, message);
}

port.onMessage.addListener((request) => {
  sendMessageToTab(request)
    .then((resp) => port.postMessage(resp))
    .catch((e) => port.postMessage({ id: request.id, error: e.toString() }));
});
