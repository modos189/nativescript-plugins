package com.modos189.webviewxgecko;

import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.DialogInterface;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.VelocityTracker;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.lang.ref.WeakReference;
import java.net.URLDecoder;
import org.mozilla.geckoview.AllowOrDeny;
import org.mozilla.geckoview.GeckoResult;
import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoRuntimeSettings;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoView;

/**
 * Manages GeckoRuntime singleton and handles popup windows (window.open) natively
 * via a slide-up Dialog — no JS bridge involvement in the popup flow.
 */
public class GeckoPopupHelper {

    /** Callback so the host app can intercept popup navigations (e.g. OAuth redirects). */
    public interface PopupUrlInterceptor {
        /** Return true to intercept: the popup is dismissed and the URL is passed to the host. */
        boolean shouldHandleExternally(String url);
    }

    private static GeckoRuntime sRuntime;

    private final GeckoSession session;
    private final WeakReference<Context> contextRef;
    private volatile boolean supportPopups;
    private PopupUrlInterceptor urlInterceptor;

    public GeckoPopupHelper(GeckoSession session, Context context, boolean supportPopups) {
        this.session = session;
        this.contextRef = new WeakReference<>(context);
        this.supportPopups = supportPopups;
        setupNavigationDelegate();
    }

    public void setUrlInterceptor(PopupUrlInterceptor interceptor) {
        this.urlInterceptor = interceptor;
    }

    public static GeckoRuntime getRuntime(Context context) {
        if (sRuntime == null) {
            Bundle extras = new Bundle();
            // Allow window.open() without requiring a click event
            extras.putString("pref.dom.disable_open_during_load", "false");
            extras.putString("pref.dom.disable_open_click_delay", "0");
            GeckoRuntimeSettings settings = new GeckoRuntimeSettings.Builder()
                    .extras(extras)
                    .build();
            sRuntime = GeckoRuntime.create(context.getApplicationContext(), settings);
        }
        return sRuntime;
    }

    public static void setRemoteDebuggingEnabled(boolean enabled) {
        if (sRuntime != null) {
            sRuntime.getSettings().setRemoteDebuggingEnabled(enabled);
        }
    }

    public void setSupportPopups(boolean value) {
        this.supportPopups = value;
    }

    private void setupNavigationDelegate() {
        final Handler mainHandler = new Handler(Looper.getMainLooper());

        session.setNavigationDelegate(new GeckoSession.NavigationDelegate() {
            @Override
            public GeckoResult<GeckoSession> onNewSession(final GeckoSession parent, final String uri) {
                if (!supportPopups) return null;

                final GeckoSession popup = new GeckoSession();
                final PopupUrlInterceptor interceptor = GeckoPopupHelper.this.urlInterceptor;
                mainHandler.post(new Runnable() {
                    public void run() {
                        Context ctx = contextRef.get();
                        if (ctx != null) showPopupDialog(ctx, popup, parent, uri, interceptor);
                    }
                });
                return GeckoResult.fromValue(popup);
            }
        });
    }

    private static Activity getActivity(Context context) {
        while (context instanceof ContextWrapper) {
            if (context instanceof Activity) return (Activity) context;
            context = ((ContextWrapper) context).getBaseContext();
        }
        return null;
    }

    private static void showPopupDialog(
            Context context,
            final GeckoSession popupSession,
            final GeckoSession mainSession,
            String uri,
            final PopupUrlInterceptor urlInterceptor) {

        final Activity activity = getActivity(context);
        if (activity == null) return;

        final float dp = activity.getResources().getDisplayMetrics().density;
        final int toolbarH = (int) (48 * dp);
        final int padH = (int) (20 * dp);
        android.graphics.Rect initFrame = new android.graphics.Rect();
        activity.getWindow().getDecorView().getWindowVisibleDisplayFrame(initFrame);
        final int[] sheetH = {initFrame.height() - toolbarH / 2};

        // Dim overlay on the Activity decor view
        final ViewGroup activityDecor = (ViewGroup) activity.getWindow().getDecorView();
        final View dimView = new View(activity);
        dimView.setBackgroundColor(Color.argb(102, 0, 0, 0));
        dimView.setAlpha(0f);
        activityDecor.addView(dimView, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        dimView.animate().alpha(1f).setDuration(350).start();

        final Dialog dialog = new Dialog(activity);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        final int touchSlop = ViewConfiguration.get(activity).getScaledTouchSlop();
        final float[] dragStartRawY = {0f};
        final float[] interceptDownY = {0f};
        final VelocityTracker[] vt = {null};
        // Set after content is built; safe because it's only invoked after dialog.show().
        final Runnable[] doAnimatedDismiss = {null};

        // Sheet root — recalculates height on rotation
        final LinearLayout content = new LinearLayout(activity) {
            @Override
            protected void onMeasure(int widthSpec, int heightSpec) {
                // Query the dialog's own window frame; the activity window frame would
                // not reflect keyboard insets inside a separate dialog window.
                android.graphics.Rect fr = new android.graphics.Rect();
                getWindowVisibleDisplayFrame(fr);
                if (fr.height() > 0) sheetH[0] = fr.height() - toolbarH / 2;
                super.onMeasure(widthSpec,
                        MeasureSpec.makeMeasureSpec(sheetH[0], MeasureSpec.EXACTLY));
            }
        };
        content.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable sheetBg = new GradientDrawable();
        sheetBg.setColor(Color.parseColor("#222222"));
        float cornerR = 16 * dp;
        sheetBg.setCornerRadii(new float[]{cornerR, cornerR, cornerR, cornerR, 0, 0, 0, 0});
        content.setBackground(sheetBg);

        // Toolbar — drag downward to dismiss
        final LinearLayout toolbar = new LinearLayout(activity) {
            private float downY;
            private boolean dragging;

            @Override
            public boolean onInterceptTouchEvent(MotionEvent ev) {
                switch (ev.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        downY = ev.getRawY(); dragging = false; break;
                    case MotionEvent.ACTION_MOVE:
                        if (!dragging && ev.getRawY() - downY > touchSlop) {
                            dragging = true;
                            dragStartRawY[0] = ev.getRawY();
                            if (vt[0] != null) vt[0].recycle();
                            vt[0] = VelocityTracker.obtain();
                            vt[0].addMovement(ev);
                            content.animate().cancel();
                        }
                        break;
                    case MotionEvent.ACTION_UP: case MotionEvent.ACTION_CANCEL:
                        dragging = false; break;
                }
                return dragging;
            }

            @Override
            public boolean onTouchEvent(MotionEvent ev) {
                switch (ev.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        downY = ev.getRawY(); dragging = false; return true;
                    case MotionEvent.ACTION_MOVE:
                        if (!dragging) {
                            if (ev.getRawY() - downY > touchSlop) {
                                dragging = true;
                                dragStartRawY[0] = ev.getRawY();
                                if (vt[0] != null) vt[0].recycle();
                                vt[0] = VelocityTracker.obtain();
                                vt[0].addMovement(ev);
                                content.animate().cancel();
                            }
                            return true;
                        }
                        float delta = ev.getRawY() - dragStartRawY[0];
                        if (delta > 0) content.setTranslationY(delta);
                        if (vt[0] != null) vt[0].addMovement(ev);
                        return true;
                    case MotionEvent.ACTION_UP: case MotionEvent.ACTION_CANCEL:
                        if (dragging) {
                            dragging = false;
                            float totalDelta = ev.getRawY() - dragStartRawY[0];
                            float yVelocity = 0;
                            if (vt[0] != null) {
                                vt[0].addMovement(ev);
                                vt[0].computeCurrentVelocity(1000);
                                yVelocity = vt[0].getYVelocity();
                                vt[0].recycle();
                                vt[0] = null;
                            }
                            if (totalDelta > sheetH[0] * 0.3f || yVelocity > 1000)
                                doAnimatedDismiss[0].run();
                            else
                                content.animate().translationY(0).setDuration(200).start();
                        }
                        return true;
                }
                return false;
            }
        };
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        content.addView(toolbar, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, toolbarH));

        final TextView titleView = new TextView(activity);
        String initialHost = "loading...";
        try {
            String h = new java.net.URI(uri).getHost();
            if (h != null && !h.isEmpty()) initialHost = h;
        } catch (Exception ignored) {}
        titleView.setText(initialHost);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        titleView.setIncludeFontPadding(false);
        titleView.setPadding(padH, 0, 0, 0);
        toolbar.addView(titleView, new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        final Button closeBtn = new Button(activity);
        closeBtn.setText("✕");
        closeBtn.setTextColor(Color.WHITE);
        closeBtn.setBackgroundColor(Color.TRANSPARENT);
        closeBtn.setMinWidth(0);
        closeBtn.setMinimumWidth(0);
        closeBtn.setGravity(Gravity.CENTER);
        closeBtn.setPadding(padH / 2, 0, padH, 0);
        toolbar.addView(closeBtn, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.MATCH_PARENT));

        // GeckoView wrapper — intercepts downward swipe when scrolled to top
        final GeckoView geckoView = new GeckoView(activity);
        FrameLayout geckoWrapper = new FrameLayout(activity) {
            private boolean intercepting;

            @Override
            public boolean onInterceptTouchEvent(MotionEvent ev) {
                switch (ev.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        interceptDownY[0] = ev.getRawY(); intercepting = false; break;
                    case MotionEvent.ACTION_MOVE:
                        if (!intercepting) {
                            float dy = ev.getRawY() - interceptDownY[0];
                            if (dy > touchSlop && geckoView.getScrollY() == 0) {
                                intercepting = true;
                                dragStartRawY[0] = ev.getRawY();
                                if (vt[0] != null) vt[0].recycle();
                                vt[0] = VelocityTracker.obtain();
                                vt[0].addMovement(ev);
                                content.animate().cancel();
                            }
                        }
                        break;
                    case MotionEvent.ACTION_UP: case MotionEvent.ACTION_CANCEL:
                        intercepting = false; break;
                }
                return intercepting;
            }

            @Override
            public boolean onTouchEvent(MotionEvent ev) {
                if (!intercepting) return false;
                switch (ev.getAction()) {
                    case MotionEvent.ACTION_MOVE:
                        float delta = ev.getRawY() - dragStartRawY[0];
                        if (delta > 0) content.setTranslationY(delta);
                        if (vt[0] != null) vt[0].addMovement(ev);
                        return true;
                    case MotionEvent.ACTION_UP: case MotionEvent.ACTION_CANCEL:
                        intercepting = false;
                        float totalDelta = ev.getRawY() - dragStartRawY[0];
                        float yVelocity = 0;
                        if (vt[0] != null) {
                            vt[0].addMovement(ev);
                            vt[0].computeCurrentVelocity(1000);
                            yVelocity = vt[0].getYVelocity();
                            vt[0].recycle();
                            vt[0] = null;
                        }
                        if (totalDelta > sheetH[0] * 0.3f || yVelocity > 1000)
                            doAnimatedDismiss[0].run();
                        else
                            content.animate().translationY(0).setDuration(200).start();
                        return true;
                }
                return true;
            }
        };
        geckoWrapper.addView(geckoView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        content.addView(geckoWrapper, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        // Full-screen transparent root so the dialog window is MATCH_PARENT × MATCH_PARENT
        FrameLayout dialogRoot = new FrameLayout(activity);
        FrameLayout.LayoutParams contentLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        contentLp.gravity = Gravity.BOTTOM;
        dialogRoot.addView(content, contentLp);
        dialog.setContentView(dialogRoot);

        Window window = dialog.getWindow();
        if (window != null) {
            window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            window.setDimAmount(0f);
            // Resize the dialog window to the visible area above the keyboard
            window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        }

        final Handler mainHandler = new Handler(Looper.getMainLooper());

        doAnimatedDismiss[0] = new Runnable() {
            @Override public void run() {
                float current = content.getTranslationY();
                long duration = Math.max(80L, (long) (250 * (1f - current / sheetH[0])));
                dimView.animate().alpha(0f).setDuration(duration).start();
                content.animate()
                        .translationY(sheetH[0])
                        .setDuration(duration)
                        .withEndAction(new Runnable() {
                            @Override public void run() { dialog.dismiss(); }
                        })
                        .start();
            }
        };

        final Runnable onClose = doAnimatedDismiss[0];

        closeBtn.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { doAnimatedDismiss[0].run(); }
        });

        dialog.setOnKeyListener(new DialogInterface.OnKeyListener() {
            @Override public boolean onKey(DialogInterface d, int keyCode, KeyEvent event) {
                if (keyCode == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
                    doAnimatedDismiss[0].run();
                    return true;
                }
                return false;
            }
        });

        // Tracks whether the popup closed itself (gecko-bridge or window.close).
        // If not, notify the main session so it can clean up.
        final boolean[] closedByPopup = {false};

        dialog.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface d) {
                activityDecor.removeView(dimView);
                if (!closedByPopup[0]) {
                    mainSession.loadUri("javascript:window.__geckoPopupReturn && "
                            + "window.__geckoPopupReturn(null)");
                }
                popupSession.close();
            }
        });

        // Gecko delegates — navigation interception, gecko-bridge, title update, close
        popupSession.setNavigationDelegate(new GeckoSession.NavigationDelegate() {
            @Override
            public GeckoResult<AllowOrDeny> onLoadRequest(
                    GeckoSession s, GeckoSession.NavigationDelegate.LoadRequest req) {
                if (req.uri == null) return null;

                if (!req.uri.startsWith("gecko-bridge://") && urlInterceptor != null
                        && urlInterceptor.shouldHandleExternally(req.uri)) {
                    mainHandler.post(onClose);
                    return GeckoResult.fromValue(AllowOrDeny.DENY);
                }

                if (req.uri.startsWith("gecko-bridge://return")) {
                    try {
                        String[] parts = req.uri.split("\\?data=", 2);
                        String json = parts.length > 1
                                ? URLDecoder.decode(parts[1], "UTF-8")
                                : "null";
                        mainSession.loadUri("javascript:window.__geckoPopupReturn && "
                                + "window.__geckoPopupReturn(" + json + ")");
                    } catch (Exception ignored) {}
                    closedByPopup[0] = true;
                    mainHandler.post(onClose);
                    return GeckoResult.fromValue(AllowOrDeny.DENY);
                }

                // Update title bar host on navigation
                try {
                    String h = new java.net.URI(req.uri).getHost();
                    if (h != null && !h.isEmpty()) {
                        final String host = h;
                        mainHandler.post(new Runnable() {
                            public void run() { titleView.setText(host); }
                        });
                    }
                } catch (Exception ignored) {}

                return null;
            }
        });

        popupSession.setContentDelegate(new GeckoSession.ContentDelegate() {
            @Override
            public void onCloseRequest(GeckoSession session) {
                closedByPopup[0] = true;
                mainHandler.post(onClose);
            }
        });

        // Open session and show with slide-up entrance
        geckoView.setSession(popupSession);
        dialog.show();
        content.setTranslationY(sheetH[0]);
        content.animate().translationY(0).setDuration(350).start();
    }
}
