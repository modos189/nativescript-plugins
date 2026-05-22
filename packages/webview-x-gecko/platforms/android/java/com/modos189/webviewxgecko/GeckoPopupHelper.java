package com.modos189.webviewxgecko;

import android.app.Activity;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.DialogInterface;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.google.android.material.bottomsheet.BottomSheetBehavior;
import com.google.android.material.bottomsheet.BottomSheetDialog;
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
 * via a BottomSheetDialog — no JS bridge involvement in the popup flow.
 */
public class GeckoPopupHelper {

    private static GeckoRuntime sRuntime;

    private final GeckoSession session;
    private final WeakReference<Context> contextRef;
    private volatile boolean supportPopups;

    public GeckoPopupHelper(GeckoSession session, Context context, boolean supportPopups) {
        this.session = session;
        this.contextRef = new WeakReference<>(context);
        this.supportPopups = supportPopups;
        setupNavigationDelegate();
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
                // Gecko opens the session on its own thread; show the sheet on main thread
                mainHandler.post(new Runnable() {
                    public void run() {
                        Context ctx = contextRef.get();
                        if (ctx != null) showPopupSheet(ctx, popup, parent, uri);
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

    private static void showPopupSheet(
            Context context,
            final GeckoSession popupSession,
            final GeckoSession mainSession,
            String uri) {

        Activity activity = getActivity(context);
        if (activity == null) return;

        final float dp = activity.getResources().getDisplayMetrics().density;
        final int toolbarH = (int) (48 * dp);
        final int padH = (int) (20 * dp);

        String host = "loading...";
        try {
            String h = new java.net.URI(uri).getHost();
            if (h != null && !h.isEmpty()) host = h;
        } catch (Exception ignored) {
        }

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

        TextView titleView = new TextView(activity);
        titleView.setText(host);
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

        GeckoView geckoView = new GeckoView(activity);
        content.addView(geckoView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        dialog.setContentView(content);

        View sheet = dialog.findViewById(com.google.android.material.R.id.design_bottom_sheet);
        if (sheet != null) {
            // Transparent background so GeckoView's SurfaceView shows through toolbar corners
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

        final Handler mainHandler = new Handler(Looper.getMainLooper());
        // Tracks whether the popup was closed via gecko-bridge://return or window.close().
        // Used by the dismiss listener to decide whether to send a null-return notification.
        final boolean[] closedByPopup = {false};
        final Runnable onClose = new Runnable() {
            public void run() {
                closedByPopup[0] = true;
                dialog.dismiss();
            }
        };

        closeBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                dialog.dismiss();
            }
        });

        dialog.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override
            public void onDismiss(DialogInterface d) {
                if (!closedByPopup[0]) {
                    // User dismissed manually — notify main session so it can clean up
                    mainSession.loadUri("javascript:window.__geckoPopupReturn && "
                            + "window.__geckoPopupReturn(null)");
                }
                popupSession.close();
            }
        });

        // Gecko already opened the session when onNewSession returned it
        geckoView.setSession(popupSession);
        attachPopupDelegates(popupSession, mainSession, onClose, mainHandler);

        dialog.show();
    }

    /**
     * Attaches delegates to the popup session:
     * - gecko-bridge://return passes data back to the main session and closes the sheet
     * - window.close() closes the sheet
     */
    private static void attachPopupDelegates(
            GeckoSession popupSession,
            final GeckoSession mainSession,
            final Runnable onClose,
            final Handler mainHandler) {

        popupSession.setNavigationDelegate(new GeckoSession.NavigationDelegate() {
            @Override
            public GeckoResult<AllowOrDeny> onLoadRequest(
                    GeckoSession s,
                    GeckoSession.NavigationDelegate.LoadRequest req) {
                if (req.uri != null && req.uri.startsWith("gecko-bridge://return")) {
                    try {
                        String[] parts = req.uri.split("\\?data=", 2);
                        String json = parts.length > 1
                                ? URLDecoder.decode(parts[1], "UTF-8")
                                : "null";
                        mainSession.loadUri("javascript:window.__geckoPopupReturn && "
                                + "window.__geckoPopupReturn(" + json + ")");
                    } catch (Exception ignored) {
                    }
                    mainHandler.post(onClose);
                    return GeckoResult.fromValue(AllowOrDeny.DENY);
                }
                return null;
            }
        });

        popupSession.setContentDelegate(new GeckoSession.ContentDelegate() {
            @Override
            public void onCloseRequest(GeckoSession session) {
                mainHandler.post(onClose);
            }
        });
    }
}
