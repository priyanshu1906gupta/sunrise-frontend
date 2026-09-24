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

    private SwipeRefreshLayout swipeRefresh;
    private volatile String pageHref = "";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        wrapWebView();
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
                    view.evaluateJavascript(
                        "(function(){function n(){if(window.SunriseShell)SunriseShell.setPath(location.href)}"
                            + "window.addEventListener('hashchange',n);window.addEventListener('popstate',n);n();})()",
                        null
                    );
                }
            }
        );

        swipeRefresh.setOnRefreshListener(
            () -> {
                webView.evaluateJavascript(
                    "(function(){return location.href})()",
                    value -> {
                        String href = unquoteJs(value);
                        if (isLiveRoom(href) || isLiveRoom(pageHref) || isLiveRoom(webView.getUrl())) {
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
            (parentView, child) -> isLiveRoom(pageHref) || isLiveRoom(webView.getUrl())
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
    }
}
