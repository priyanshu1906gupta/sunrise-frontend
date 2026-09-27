package com.sunrisecoaching.khargone;

import android.os.Bundle;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {
    private static final Pattern LIVE_ROOM = Pattern.compile("(?i).*(?:#/|/)live-classes/[^/#?]+");
    private static final String PATH_WATCH_JS =
        "(function(){function n(){if(window.SunriseShell)SunriseShell.setPath(location.href)}"
            + "window.addEventListener('hashchange',n);window.addEventListener('popstate',n);n();})()";
    private static final String SCROLL_WATCH_JS =
        "(function(){if(window.__sunriseScrollWatch)return;window.__sunriseScrollWatch=1;"
            + "function pageAtTop(){var y=window.pageYOffset||document.documentElement.scrollTop||document.body.scrollTop||0;"
            + "if(y>1)return false;"
            + "var sels=['.ff-page-body','.wrapper','.sidebar.show','.ng-scroll-viewport','.os-viewport',"
            + "'[data-overlayscrollbars-viewport]','.live-chat-list','main'];"
            + "for(var i=0;i<sels.length;i++){var nodes=document.querySelectorAll(sels[i]);"
            + "for(var j=0;j<nodes.length;j++){if(nodes[j].scrollTop>1)return false;}}"
            + "return true;}"
            + "function report(){if(window.SunriseShell&&SunriseShell.setScroll)SunriseShell.setScroll(!pageAtTop());}"
            + "window.addEventListener('scroll',report,{passive:true});"
            + "document.addEventListener('scroll',report,{passive:true,capture:true});"
            + "window.addEventListener('touchmove',report,{passive:true});"
            + "window.addEventListener('hashchange',report);"
            + "setInterval(report,250);report();})()";

    private SwipeRefreshLayout swipeRefresh;
    private volatile String pageHref = "";
    private volatile boolean pageCanScrollUp = false;
    private AppUpdateHelper appUpdate;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
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

    private void wrapWebView() {
        if (bridge == null) {
            return;
        }
        final WebView webView = bridge.getWebView();
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
        swipeRefresh.addView(
            webView,
            new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        );
        parent.addView(swipeRefresh, index, params);

        webView.addJavascriptInterface(new ShellBridge(), "SunriseShell");
        bridge.addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageLoaded(WebView view) {
                    view.evaluateJavascript(PATH_WATCH_JS + SCROLL_WATCH_JS, null);
                }
            }
        );

        swipeRefresh.setOnRefreshListener(
            () -> {
                webView.evaluateJavascript(
                    "(function(){return location.href})()",
                    value -> {
                        String href = unquoteJs(value);
                        if (pageCanScrollUp || isLiveRoom(href) || isLiveRoom(pageHref) || isLiveRoom(webView.getUrl())) {
                            swipeRefresh.setRefreshing(false);
                            return;
                        }
                        webView.reload();
                        swipeRefresh.setRefreshing(false);
                    }
                );
            }
        );
        swipeRefresh.setOnChildScrollUpCallback(
            (parentView, child) -> pageCanScrollUp || isLiveRoom(pageHref) || isLiveRoom(webView.getUrl())
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
        }

        @JavascriptInterface
        public void setScroll(boolean canScrollUp) {
            pageCanScrollUp = canScrollUp;
        }

        @JavascriptInterface
        public void startUpdateCheck(String manifestUrl) {
            if (appUpdate != null) {
                appUpdate.startUpdateCheck(manifestUrl);
            }
        }
    }
}
