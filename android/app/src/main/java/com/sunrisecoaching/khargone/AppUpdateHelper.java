package com.sunrisecoaching.khargone;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public class AppUpdateHelper {
    private static final String TAG = "SunriseUpdate";
    private static final String APK_NAME = "sunrise-update.apk";

    private final Activity activity;
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile String pendingManifestUrl;
    private volatile boolean checking;
    private volatile boolean downloading;
    private volatile boolean askedInstallPermission;

    public AppUpdateHelper(Activity activity) {
        this.activity = activity;
    }

    public void startUpdateCheck(String manifestUrl) {
        if (manifestUrl == null || manifestUrl.trim().isEmpty()) {
            return;
        }
        pendingManifestUrl = manifestUrl.trim();
        if (checking || downloading) {
            return;
        }
        checking = true;
        new Thread(
            () -> {
                try {
                    check(pendingManifestUrl);
                } catch (Exception error) {
                    Log.w(TAG, "update check failed", error);
                } finally {
                    checking = false;
                }
            },
            "sunrise-update-check"
        )
            .start();
    }

    public void onResume() {
        if (pendingManifestUrl == null || downloading || checking) {
            return;
        }
        if (!canInstallPackages() && askedInstallPermission) {
            return;
        }
        startUpdateCheck(pendingManifestUrl);
    }

    private void check(String manifestUrl) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(manifestUrl).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setRequestProperty("Cache-Control", "no-store");
        connection.connect();
        int status = connection.getResponseCode();
        if (status != 200) {
            connection.disconnect();
            return;
        }
        String body = readAll(connection.getInputStream());
        connection.disconnect();

        JSONObject androidInfo = new JSONObject(body).optJSONObject("android");
        if (androidInfo == null || !androidInfo.optBoolean("available", false)) {
            return;
        }
        int remoteCode = androidInfo.optInt("versionCode", 0);
        if (remoteCode <= currentVersionCode()) {
            return;
        }
        String file = androidInfo.optString("file", "android.apk");
        String apkUrl = resolveApkUrl(manifestUrl, file);
        main.post(
            () -> {
                if (!canInstallPackages()) {
                    requestInstallPermission();
                    return;
                }
                startDownload(apkUrl);
            }
        );
    }

    private void startDownload(String apkUrl) {
        if (downloading) {
            return;
        }
        downloading = true;
        Toast.makeText(activity, "Downloading update…", Toast.LENGTH_LONG).show();
        new Thread(
            () -> {
                try {
                    File apk = downloadApk(apkUrl);
                    main.post(() -> installApk(apk));
                } catch (Exception error) {
                    Log.w(TAG, "download failed", error);
                    main.post(() -> Toast.makeText(activity, "Update download failed", Toast.LENGTH_SHORT).show());
                } finally {
                    downloading = false;
                }
            },
            "sunrise-update-dl"
        )
            .start();
    }

    private File downloadApk(String apkUrl) throws Exception {
        File dir = new File(activity.getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new Exception("Could not create update cache");
        }
        File out = new File(dir, APK_NAME);
        HttpURLConnection connection = (HttpURLConnection) new URL(apkUrl).openConnection();
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(120000);
        connection.connect();
        if (connection.getResponseCode() != 200) {
            int code = connection.getResponseCode();
            connection.disconnect();
            throw new Exception("HTTP " + code);
        }
        try (InputStream in = connection.getInputStream(); FileOutputStream fos = new FileOutputStream(out)) {
            byte[] buf = new byte[8192];
            int read;
            while ((read = in.read(buf)) > 0) {
                fos.write(buf, 0, read);
            }
        } finally {
            connection.disconnect();
        }
        return out;
    }

    private void installApk(File apk) {
        if (!canInstallPackages()) {
            requestInstallPermission();
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception error) {
            Log.w(TAG, "install intent failed", error);
            Toast.makeText(activity, "Could not open installer", Toast.LENGTH_SHORT).show();
        }
    }

    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return true;
        }
        return activity.getPackageManager().canRequestPackageInstalls();
    }

    private void requestInstallPermission() {
        if (askedInstallPermission) {
            return;
        }
        askedInstallPermission = true;
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + activity.getPackageName()));
            activity.startActivity(intent);
            Toast.makeText(activity, "Allow installing updates, then return to the app", Toast.LENGTH_LONG).show();
        } catch (Exception error) {
            Log.w(TAG, "cannot open install settings", error);
        }
    }

    private int currentVersionCode() {
        try {
            PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return (int) info.getLongVersionCode();
            }
            return info.versionCode;
        } catch (PackageManager.NameNotFoundException error) {
            return 0;
        }
    }

    private static String resolveApkUrl(String manifestUrl, String file) {
        int slash = manifestUrl.lastIndexOf('/');
        String base = slash >= 0 ? manifestUrl.substring(0, slash + 1) : manifestUrl;
        return base + file;
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[2048];
        int read;
        while ((read = in.read(buf)) > 0) {
            out.write(buf, 0, read);
        }
        return out.toString("UTF-8");
    }
}
