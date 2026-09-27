package com.sunrisecoaching.khargone;

import android.graphics.Color;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {
    private static final Pattern LIVE_ROOM = Pattern.compile("(?i).*(?:#/|/)live-classes/[^/#?]+");
    private static final int TOP_EDGE_DP = 88;
    private static final int PULL_DISTANCE_DP = 96;
    private static final String BOOTSTRAP_JS =
        "(function(){var r=document.documentElement;r.classList.add('platform-native','platform-android');})()";
    private static final String PATH_WATCH_JS =
        "(function(){function n(){if(window.SunriseShell)SunriseShell.setPath(location.href)}"
            + "window.addEventListener('hashchange',n);window.addEventListener('popstate',n);n();})()";
    private static final String PAGE_AT_TOP_JS =
        "(function(){function atTop(){"
            + "var y=window.pageYOffset||document.documentElement.scrollTop||document.body.scrollTop||0;"
            + "if(y>2)return false;"
            + "var roots=[document.scrollingElement,document.documentElement,document.body];"
            + "for(var r=0;r<roots.length;r++){if(roots[r]&&roots[r].scrollTop>2)return false;}"
            + "var sels=['.ff-page-body','.wrapper','.ff-app','.body','main','.sidebar.show',"
            + "'.ng-scroll-viewport','.os-viewport','[data-overlayscrollbars-viewport]','.live-chat-list',"
            + "'ng-scrollbar','.cdk-virtual-scroll-viewport','.table-responsive','.modal.show','.offcanvas.show'];"
            + "for(var i=0;i<sels.length;i++){var nodes=document.querySelectorAll(sels[i]);"
            + "for(var j=0;j<nodes.length;j++){if(nodes[j].scrollTop>2)return false;}}"
            + "return true;}return atTop();})()";
    private static final String SCROLL_WATCH_JS =
        "(function(){if(window.__sunriseScrollWatch)return;window.__sunriseScrollWatch=1;"
            + "function pageAtTop(){var y=window.pageYOffset||document.documentElement.scrollTop||document.body.scrollTop||0;"
            + "if(y>2)return false;"
            + "var roots=[document.scrollingElement,document.documentElement,document.body];"
            + "for(var r=0;r<roots.length;r++){if(roots[r]&&roots[r].scrollTop>2)return false;}"
            + "var sels=['.ff-page-body','.wrapper','.ff-app','.body','main','.sidebar.show',"
            + "'.ng-scroll-viewport','.os-viewport','[data-overlayscrollbars-viewport]','.live-chat-list',"
            + "'ng-scrollbar','.cdk-virtual-scroll-viewport','.table-responsive','.modal.show','.offcanvas.show'];"
            + "for(var i=0;i<sels.length;i++){var nodes=document.querySelectorAll(sels[i]);"
            + "for(var j=0;j<nodes.length;j++){if(nodes[j].scrollTop>2)return false;}}"
            + "return true;}"
            + "function report(){if(window.SunriseShell&&SunriseShell.setScroll)SunriseShell.setScroll(!pageAtTop());}"
            + "window.addEventListener('scroll',report,{passive:true});"
            + "document.addEventListener('scroll',report,{passive:true,capture:true});"
            + "window.addEventListener('touchstart',report,{passive:true});"
            + "window.addEventListener('touchmove',report,{passive:true});"
            + "window.addEventListener('hashchange',report);"
            + "setInterval(report,160);report();})()";

    private SwipeRefreshLayout swipeRefresh;
    private volatile String pageHref = "";
    private volatile boolean pageCanScrollUp = true;
    private volatile boolean touchFromTopEdge = false;
    private AppUpdateHelper appUpdate;
    private int topEdgePx;
    private WebView webView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySystemBarInsets();
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        topEdgePx = dp(TOP_EDGE_DP);
        appUpdate = new AppUpdateHelper(this);
        wrapWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (appUpdate != null) {
            appUpdate.onResume();
        }
    }

    private void applySystemBarInsets() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(true);
            controller.setAppearanceLightNavigationBars(true);
        }
        View root = findViewById(android.R.id.content);
        if (root == null) {
            return;
        }
        root.setBackgroundColor(Color.WHITE);
        ViewCompat.setOnApplyWindowInsetsListener(
            root,
            (v, insets) -> {
                Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsetsCompat.CONSUMED;
            }
        );
        ViewCompat.requestApplyInsets(root);
    }

    private void wrapWebView() {
        if (bridge == null) {
            return;
        }
        webView = bridge.getWebView();
        if (webView == null) {
            return;
        }
        ViewGroup parent = (ViewGroup) webView.getParent();
        if (parent == null) {
            return;
        }

        int index = parent.indexOfChild(webView);
        ViewGroup.LayoutParams params = webView.getLayoutParams();
        parent.removeView(webView);

        swipeRefresh = new SwipeRefreshLayout(this);
        swipeRefresh.setLayoutParams(params);
        swipeRefresh.setEnabled(false);
        swipeRefresh.setDistanceToTriggerSync(dp(PULL_DISTANCE_DP));
        swipeRefresh.addView(
            webView,
            new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        );
        parent.addView(swipeRefresh, index, params);

        webView.addJavascriptInterface(new ShellBridge(), "SunriseShell");
        webView.setOnTouchListener(this::onWebViewTouch);
        injectShellJs(webView);
        bridge.addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageStarted(WebView view) {
                    injectShellJs(view);
                }

                @Override
                public void onPageLoaded(WebView view) {
                    injectShellJs(view);
                }
            }
        );

        swipeRefresh.setOnRefreshListener(
            () -> {
                if (!refreshAllowed()) {
                    swipeRefresh.setRefreshing(false);
                    return;
                }
                webView.reload();
                swipeRefresh.setRefreshing(false);
            }
        );
        swipeRefresh.setOnChildScrollUpCallback((parentView, child) -> !refreshAllowed());
    }

    private boolean onWebViewTouch(View view, MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            touchFromTopEdge = event.getY() <= topEdgePx;
            if (!touchFromTopEdge) {
                pageCanScrollUp = true;
                setRefreshEnabled(false);
            } else {
                webView.evaluateJavascript(
                    PAGE_AT_TOP_JS,
                    value -> {
                        boolean atTop = "true".equalsIgnoreCase(unquoteJs(value));
                        pageCanScrollUp = !atTop;
                        setRefreshEnabled(refreshAllowed());
                    }
                );
                setRefreshEnabled(refreshAllowed());
            }
        } else if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
            if (pageCanScrollUp || !touchFromTopEdge) {
                setRefreshEnabled(false);
            }
        }
        return false;
    }

    private boolean refreshAllowed() {
        if (webView == null || swipeRefresh == null) {
            return false;
        }
        if (!touchFromTopEdge || pageCanScrollUp) {
            return false;
        }
        if (webView.getScrollY() > 2) {
            return false;
        }
        return !isLiveRoom(pageHref) && !isLiveRoom(webView.getUrl());
    }

    private void setRefreshEnabled(boolean enabled) {
        if (swipeRefresh != null) {
            swipeRefresh.setEnabled(enabled);
        }
    }

    private void injectShellJs(WebView view) {
        if (view == null) {
            return;
        }
        view.evaluateJavascript(BOOTSTRAP_JS + PATH_WATCH_JS + SCROLL_WATCH_JS, null);
    }

    private int dp(int value) {
        return Math.round(
            TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics())
        );
    }

    private static String unquoteJs(String value) {
        if (value == null || "null".equals(value)) {
            return "";
        }
        if (value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
            return value.substring(1, value.length() - 1).replace("\\\"", "\"").replace("\\\\", "\\");
        }
        return value;
    }

    private static boolean isLiveRoom(String url) {
        return url != null && !url.isEmpty() && LIVE_ROOM.matcher(url).find();
    }

    private class ShellBridge {
        @JavascriptInterface
        public void setPath(String href) {
            pageHref = href != null ? href : "";
            runOnUiThread(() -> setRefreshEnabled(refreshAllowed()));
        }

        @JavascriptInterface
        public void setScroll(boolean canScrollUp) {
            pageCanScrollUp = canScrollUp;
            runOnUiThread(() -> {
                if (canScrollUp || !touchFromTopEdge) {
                    setRefreshEnabled(false);
                }
            });
        }

        @JavascriptInterface
        public void startUpdateCheck(String manifestUrl) {
            if (appUpdate != null) {
                appUpdate.startUpdateCheck(manifestUrl);
            }
        }
    }
}
