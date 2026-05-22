package com.modos189.webviewx;

import android.app.Activity;
import android.content.Context;
import android.content.ContextWrapper;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Message;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.google.android.material.bottomsheet.BottomSheetBehavior;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.Map;

/**
 * Wraps the existing WebChromeClient set by AWebView and adds onCreateWindow popup support.
 * All standard callbacks are forwarded to the delegate so existing functionality is preserved.
 *
 * activityContext must be the hosting Activity context (this._context from NativeScript View)
 * — view.getContext() is not used because NativeScript may wrap it in a ContextThemeWrapper
 * pointing to the Application context rather than the Activity.
 */
public class PopupWebChromeClient extends WebChromeClient {

    private final WebChromeClient delegate;
    private volatile boolean supportPopups;
    private final WeakReference<Context> activityContextRef;
    private final Map<WebView, BottomSheetDialog> popupDialogs = new HashMap<>();

    public PopupWebChromeClient(WebChromeClient delegate, boolean supportPopups, Context activityContext) {
        this.delegate = delegate;
        this.supportPopups = supportPopups;
        this.activityContextRef = new WeakReference<>(activityContext);
    }

    public void setSupportPopups(boolean value) {
        this.supportPopups = value;
    }

    @Override
    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        if (!supportPopups) return false;

        Context context = activityContextRef.get();
        if (context == null) return false;

        Activity activity = getActivity(context);
        if (activity == null) return false;

        WebView popupWebView = new WebView(activity);
        WebSettings settings = popupWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);

        // Wire the new WebView into the system's popup transport before showing UI.
        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        transport.setWebView(popupWebView);
        resultMsg.sendToTarget();

        BottomSheetDialog dialog = showPopupDialog(activity, popupWebView);
        popupDialogs.put(popupWebView, dialog);

        return true;
    }

    @Override
    public void onCloseWindow(WebView window) {
        BottomSheetDialog d = popupDialogs.remove(window);
        if (d != null) d.dismiss();
        delegate.onCloseWindow(window);
    }

    /** Unwrap ContextWrapper chain to find the hosting Activity (required for Dialog). */
    private static Activity getActivity(Context context) {
        while (context instanceof ContextWrapper) {
            if (context instanceof Activity) return (Activity) context;
            context = ((ContextWrapper) context).getBaseContext();
        }
        return null;
    }

    private BottomSheetDialog showPopupDialog(Activity activity, WebView popupWebView) {
        final float dp = activity.getResources().getDisplayMetrics().density;
        final int toolbarH = (int) (48 * dp);
        final int padH = (int) (20 * dp);

        final BottomSheetDialog dialog = new BottomSheetDialog(activity);

        LinearLayout content = new LinearLayout(activity);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout toolbar = new LinearLayout(activity);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        float r = 16 * dp;
        GradientDrawable toolbarBg = new GradientDrawable();
        toolbarBg.setColor(Color.parseColor("#222222"));
        toolbarBg.setCornerRadii(new float[]{r, r, r, r, 0, 0, 0, 0});
        toolbar.setBackground(toolbarBg);
        content.addView(toolbar, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, toolbarH));

        final TextView titleView = new TextView(activity);
        titleView.setText("loading...");
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        titleView.setIncludeFontPadding(false);
        titleView.setTranslationY(-0.5f * dp);
        titleView.setPadding(padH, 0, 0, 0);
        toolbar.addView(titleView, new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        Button closeBtn = new Button(activity);
        closeBtn.setText("✕");
        closeBtn.setTextColor(Color.WHITE);
        closeBtn.setBackgroundColor(Color.TRANSPARENT);
        closeBtn.setMinWidth(0);
        closeBtn.setMinimumWidth(0);
        closeBtn.setGravity(android.view.Gravity.CENTER);
        closeBtn.setTranslationY(-0.5f * dp);
        closeBtn.setPadding(padH / 2, 0, padH, 0);
        toolbar.addView(closeBtn, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.MATCH_PARENT));

        content.addView(popupWebView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        popupWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onCloseWindow(WebView window) {
                BottomSheetDialog d = (BottomSheetDialog) popupDialogs.remove(window);
                if (d != null) d.dismiss();
            }
        });

        popupWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                String host = Uri.parse(url).getHost();
                if (host != null && !host.isEmpty()) titleView.setText(host);
            }
        });

        dialog.setContentView(content);

        View sheet = dialog.findViewById(com.google.android.material.R.id.design_bottom_sheet);
        if (sheet != null) {
            sheet.setBackgroundColor(Color.TRANSPARENT);
            ViewGroup.LayoutParams lp = sheet.getLayoutParams();
            lp.height = ViewGroup.LayoutParams.MATCH_PARENT;
            sheet.setLayoutParams(lp);
            BottomSheetBehavior<View> behavior = BottomSheetBehavior.from(sheet);
            behavior.setFitToContents(false);
            behavior.setExpandedOffset(toolbarH / 2);
            behavior.setSkipCollapsed(true);
            behavior.setState(BottomSheetBehavior.STATE_EXPANDED);
        }

        closeBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                dialog.dismiss();
            }
        });

        dialog.setOnDismissListener(d -> popupWebView.destroy());

        dialog.show();

        return dialog;
    }

    // Forward all standard WebChromeClient callbacks to the original AWebView client.

    @Override
    public void onProgressChanged(WebView view, int newProgress) {
        delegate.onProgressChanged(view, newProgress);
    }

    @Override
    public void onReceivedTitle(WebView view, String title) {
        delegate.onReceivedTitle(view, title);
    }

    @Override
    public void onReceivedIcon(WebView view, Bitmap icon) {
        delegate.onReceivedIcon(view, icon);
    }

    @Override
    public void onReceivedTouchIconUrl(WebView view, String url, boolean precomposed) {
        delegate.onReceivedTouchIconUrl(view, url, precomposed);
    }

    @Override
    public void onShowCustomView(View view, CustomViewCallback callback) {
        delegate.onShowCustomView(view, callback);
    }

    @Override
    public void onHideCustomView() {
        delegate.onHideCustomView();
    }

    @Override
    public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
        return delegate.onJsAlert(view, url, message, result);
    }

    @Override
    public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
        return delegate.onJsConfirm(view, url, message, result);
    }

    @Override
    public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result) {
        return delegate.onJsPrompt(view, url, message, defaultValue, result);
    }

    @Override
    public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
        return delegate.onConsoleMessage(consoleMessage);
    }

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
            FileChooserParams fileChooserParams) {
        return delegate.onShowFileChooser(webView, filePathCallback, fileChooserParams);
    }

    @Override
    public void onPermissionRequest(PermissionRequest request) {
        delegate.onPermissionRequest(request);
    }

    @Override
    public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
        delegate.onGeolocationPermissionsShowPrompt(origin, callback);
    }
}
