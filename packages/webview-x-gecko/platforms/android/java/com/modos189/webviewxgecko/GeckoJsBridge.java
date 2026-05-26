package com.modos189.webviewxgecko;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;
import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.WebExtension;
import org.mozilla.geckoview.WebExtensionController;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.lang.ref.WeakReference;

/**
 * Singleton bridge for executing JavaScript in GeckoView pages via a built-in WebExtension.
 * NativeScript cannot implement WebExtension delegate interfaces directly (Java 8 default
 * methods break the DEX proxy factory), so this class acts as the concrete delegate.
 */
public class GeckoJsBridge implements WebExtension.MessageDelegate, WebExtension.PortDelegate {

    private static final String TAG = "GeckoJsBridge";
    private static final String EXTENSION_ID = "execute-js@app.com";
    private static final String EXTENSION_URL = "resource://android/assets/execute-js/";
    private static final String PORT_NAME = "native";

    private static volatile GeckoJsBridge sInstance;

    private WebExtension.Port mPort;
    private final ConcurrentHashMap<String, JsCallback> mPendingCallbacks = new ConcurrentHashMap<>();
    // Accessed only on main thread after posting via mMainHandler
    private final List<JSONObject> mPendingMessages = new ArrayList<>();
    private final Handler mMainHandler = new Handler(Looper.getMainLooper());
    private final AtomicInteger mIdCounter = new AtomicInteger(0);

    public interface JsCallback {
        void onResult(String jsonResult);
        void onError(String error);
    }

    public interface BridgeEventListener {
        void onBridgeEvent(String eventName, String dataJson);
    }

    private final CopyOnWriteArrayList<WeakReference<BridgeEventListener>> mBridgeListeners = new CopyOnWriteArrayList<>();

    public void addBridgeListener(BridgeEventListener listener) {
        mBridgeListeners.add(new WeakReference<>(listener));
    }

    public void removeBridgeListener(BridgeEventListener listener) {
        mBridgeListeners.removeIf(ref -> {
            BridgeEventListener l = ref.get();
            return l == null || l == listener;
        });
    }

    private void notifyBridgeListeners(String eventName, String dataJson) {
        for (WeakReference<BridgeEventListener> ref : mBridgeListeners) {
            BridgeEventListener listener = ref.get();
            if (listener != null) {
                listener.onBridgeEvent(eventName, dataJson);
            }
        }
    }

    public static GeckoJsBridge getInstance() {
        if (sInstance == null) {
            synchronized (GeckoJsBridge.class) {
                if (sInstance == null) {
                    sInstance = new GeckoJsBridge();
                }
            }
        }
        return sInstance;
    }

    private GeckoJsBridge() {}

    public String nextId() {
        return String.valueOf(mIdCounter.incrementAndGet());
    }

    /** Idempotent - safe to call on every WebViewX creation. */
    public void setup(GeckoRuntime runtime) {
        runtime.getWebExtensionController()
            .ensureBuiltIn(EXTENSION_URL, EXTENSION_ID)
            .accept(
                extension -> mMainHandler.post(() -> {
                    if (extension == null) return;
                    // Disable then re-enable so the background script reconnects
                    // and triggers onConnect even if the extension was already loaded.
                    runtime.getWebExtensionController()
                        .disable(extension, WebExtensionController.EnableSource.APP);
                    runtime.getWebExtensionController()
                        .enable(extension, WebExtensionController.EnableSource.APP);
                    extension.setMessageDelegate(GeckoJsBridge.this, PORT_NAME);
                }),
                e -> Log.e(TAG, "Failed to install WebExtension", e)
            );
    }

    public void executeScript(final String id, final String code, final JsCallback callback) {
        final JSONObject msg;
        try {
            msg = new JSONObject();
            msg.put("id", id);
            msg.put("inject", code);
        } catch (JSONException e) {
            callback.onError(e.getMessage());
            return;
        }

        mPendingCallbacks.put(id, callback);

        mMainHandler.post(() -> {
            if (mPort != null) {
                mPort.postMessage(msg);
            } else {
                mPendingMessages.add(msg);
            }
        });
    }

    @Override
    public void onConnect(WebExtension.Port port) {
        mPort = port;
        port.setDelegate(this);

        // Flush any calls that arrived before the port was ready
        for (JSONObject msg : mPendingMessages) {
            port.postMessage(msg);
        }
        mPendingMessages.clear();
    }

    @Override
    public void onPortMessage(Object message, WebExtension.Port port) {
        if (!(message instanceof JSONObject)) return;
        final JSONObject obj = (JSONObject) message;
        try {
            if ("bridge-emit".equals(obj.optString("type"))) {
                final String eventName = obj.optString("eventName", "");
                final String data = obj.optString("data", "null");
                mMainHandler.post(() -> notifyBridgeListeners(eventName, data));
                return;
            }

            final String id = obj.getString("id");
            final JsCallback callback = mPendingCallbacks.remove(id);
            if (callback == null) return;

            if (obj.has("error")) {
                callback.onError(obj.getString("error"));
            } else {
                // optString falls back to "null" when key is absent or value is JSON null
                callback.onResult(obj.optString("result", "null"));
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error processing JS result message", e);
        }
    }

    @Override
    public void onDisconnect(WebExtension.Port port) {
        mPort = null;
    }
}
