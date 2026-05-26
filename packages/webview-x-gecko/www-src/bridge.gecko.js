(function () {
  if (window.nsWebViewBridge) {
    return;
  }

  var listeners = {};

  window.nsWebViewBridge = {
    on: function (eventName, cb) {
      if (!listeners[eventName]) {
        listeners[eventName] = [];
      }
      listeners[eventName].push(cb);
    },

    addEventListener: function (eventName, cb) {
      this.on(eventName, cb);
    },

    off: function (eventName, cb) {
      if (!eventName) {
        listeners = {};
        return;
      }
      if (!listeners[eventName]) {
        return;
      }
      if (!cb) {
        delete listeners[eventName];
        return;
      }
      listeners[eventName] = listeners[eventName].filter(function (f) {
        return f !== cb;
      });
      if (listeners[eventName].length === 0) {
        delete listeners[eventName];
      }
    },

    removeEventListener: function (eventName, cb) {
      this.off(eventName, cb);
    },

    // GeckoView has no addJavascriptInterface, so we use a CustomEvent
    // that the content script intercepts and forwards to the native layer.
    emit: function (eventName, data) {
      document.dispatchEvent(
        new CustomEvent('__ns_bridge_emit__', {
          detail: { eventName: eventName, data: JSON.stringify(data) },
        }),
      );
    },

    onNativeEvent: function (eventName, data) {
      var cbs = listeners[eventName];
      if (!cbs) {
        return;
      }
      for (var i = 0; i < cbs.length; i++) {
        if (cbs[i] && cbs[i](data) === false) {
          break;
        }
      }
    },
  };

  var w = window;
  if (typeof CustomEvent !== 'undefined') {
    w.dispatchEvent(new CustomEvent('ns-bridge-ready', { detail: w.nsWebViewBridge }));
  } else {
    w.dispatchEvent(new Event('ns-bridge-ready'));
  }
  // Typo kept for backward compatibility with apps that listen for 'ns-brige-ready'
  w.dispatchEvent(new Event('ns-brige-ready'));
})();
