package com.modos189.webviewx;

import android.graphics.Bitmap;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.FileInputStream;
import java.io.File;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Wraps the NativeScript WebViewClient to handle shouldInterceptRequest entirely in Java.
 *
 * Android calls shouldInterceptRequest on Chromium's network thread; NativeScript cannot
 * safely dispatch JS callbacks from non-UI threads, causing fatal crashes
 * ("Cannot find runtime/object id for instance=...WebViewClient...").
 * All other callbacks run on the UI thread and are delegated to the original client unchanged.
 */
public class LocalResourceWebViewClient extends WebViewClient {

    private static final String INTERCEPT_SCHEME = "x-local";

    private static final Map<String, String> EXT_TO_MIME = new HashMap<>();
    static {
        EXT_TO_MIME.put("js",    "application/javascript");
        EXT_TO_MIME.put("mjs",   "application/javascript");
        EXT_TO_MIME.put("css",   "text/css");
        EXT_TO_MIME.put("html",  "text/html");
        EXT_TO_MIME.put("htm",   "text/html");
        EXT_TO_MIME.put("json",  "application/json");
        EXT_TO_MIME.put("xml",   "text/xml");
        EXT_TO_MIME.put("txt",   "text/plain");
        EXT_TO_MIME.put("png",   "image/png");
        EXT_TO_MIME.put("jpg",   "image/jpeg");
        EXT_TO_MIME.put("jpeg",  "image/jpeg");
        EXT_TO_MIME.put("gif",   "image/gif");
        EXT_TO_MIME.put("webp",  "image/webp");
        EXT_TO_MIME.put("svg",   "image/svg+xml");
        EXT_TO_MIME.put("ico",   "image/x-icon");
        EXT_TO_MIME.put("woff",  "font/woff");
        EXT_TO_MIME.put("woff2", "font/woff2");
        EXT_TO_MIME.put("ttf",   "font/ttf");
        EXT_TO_MIME.put("otf",   "font/otf");
        EXT_TO_MIME.put("mp4",   "video/mp4");
        EXT_TO_MIME.put("webm",  "video/webm");
    }

    private static final Set<String> TEXT_MIME_PREFIXES = new HashSet<>();
    static {
        TEXT_MIME_PREFIXES.add("text/");
        TEXT_MIME_PREFIXES.add("application/javascript");
        TEXT_MIME_PREFIXES.add("application/json");
        TEXT_MIME_PREFIXES.add("image/svg+xml");
    }

    private final WebViewClient delegate;
    private final ConcurrentHashMap<String, String> resourceMap = new ConcurrentHashMap<>();

    public LocalResourceWebViewClient(WebViewClient delegate) {
        this.delegate = delegate;
    }

    public void registerResource(String name, String filePath) {
        resourceMap.put(name, filePath);
    }

    public void unregisterResource(String name) {
        resourceMap.remove(name);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        if (!url.startsWith(INTERCEPT_SCHEME + "://")) {
            return null;
        }
        String resourceName = url.substring(INTERCEPT_SCHEME.length() + 3); // strip "x-local://"
        String filePath = resourceMap.get(resourceName);
        if (filePath == null) return null;
        File file = new File(filePath);
        if (!file.exists()) return null;
        try {
            String ext = "";
            int dot = filePath.lastIndexOf('.');
            if (dot >= 0) ext = filePath.substring(dot + 1).toLowerCase();
            String mime = EXT_TO_MIME.containsKey(ext) ? EXT_TO_MIME.get(ext) : "application/octet-stream";
            boolean isText = false;
            for (String prefix : TEXT_MIME_PREFIXES) {
                if (mime.startsWith(prefix)) { isText = true; break; }
            }
            String encoding = isText ? "UTF-8" : "binary";
            WebResourceResponse response = new WebResourceResponse(
                    mime, encoding, new FileInputStream(file));
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            response.setResponseHeaders(headers);
            return response;
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return delegate.shouldOverrideUrlLoading(view, request);
    }

    @Override
    @SuppressWarnings("deprecation")
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return delegate.shouldOverrideUrlLoading(view, url);
    }

    @Override
    public void onPageStarted(WebView view, String url, Bitmap favicon) {
        delegate.onPageStarted(view, url, favicon);
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        delegate.onPageFinished(view, url);
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        delegate.onReceivedError(view, request, error);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
        delegate.onReceivedError(view, errorCode, description, failingUrl);
    }

    @Override
    public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                    WebResourceResponse errorResponse) {
        delegate.onReceivedHttpError(view, request, errorResponse);
    }

    @Override
    public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler,
                                   android.net.http.SslError error) {
        delegate.onReceivedSslError(view, handler, error);
    }

    @Override
    public void onLoadResource(WebView view, String url) {
        delegate.onLoadResource(view, url);
    }

    @Override
    public void onPageCommitVisible(WebView view, String url) {
        delegate.onPageCommitVisible(view, url);
    }

    @Override
    public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
        delegate.doUpdateVisitedHistory(view, url, isReload);
    }
}
