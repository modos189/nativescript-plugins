package com.modos189.webviewxgecko;

import org.mozilla.geckoview.GeckoSession;

/**
 * NativeScript cannot generate runtime DEX proxies for GeckoView interfaces directly
 * (Java 8 default methods + @UiThread annotations break the DEX factory).
 * Each delegate accepts a simple custom listener that NativeScript can proxy instead.
 */
public class GeckoDelegates {

    public interface ProgressListener {
        void onPageStart(String url);
        void onPageStop(boolean success);
        void onProgressChange(int progress);
    }

    public interface ContentListener {
        void onTitleChange(String title);
    }

    public static class ProgressDelegate implements GeckoSession.ProgressDelegate {
        private final ProgressListener listener;

        public ProgressDelegate(ProgressListener listener) {
            this.listener = listener;
        }

        @Override
        public void onPageStart(GeckoSession session, String url) {
            if (listener != null) listener.onPageStart(url != null ? url : "");
        }

        @Override
        public void onPageStop(GeckoSession session, boolean success) {
            if (listener != null) listener.onPageStop(success);
        }

        @Override
        public void onProgressChange(GeckoSession session, int progress) {
            if (listener != null) listener.onProgressChange(progress);
        }
    }

    public static class ContentDelegate implements GeckoSession.ContentDelegate {
        private final ContentListener listener;

        public ContentDelegate(ContentListener listener) {
            this.listener = listener;
        }

        @Override
        public void onTitleChange(GeckoSession session, String title) {
            if (listener != null && title != null && !title.isEmpty()) {
                listener.onTitleChange(title);
            }
        }
    }
}
