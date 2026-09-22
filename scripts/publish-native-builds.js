/**
 * Build Android APK + Windows Electron installer and copy them to
 * sunrise-backend/public/downloads/latest for the landing Download page.
 *
 * Usage (from sunrise-frontend):
 *   npm run publish:native
 *
 * Optional env:
 *   NATIVE_API_URL or PUBLIC_URL — live origin, e.g. https://yourdomain.com
 *   (written into environment.native.ts as {origin}/api before the native build)
 */
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const frontendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendRoot, "..");
const backendPublic = path.join(repoRoot, "sunrise-backend", "public", "downloads", "latest");
const envFile = path.join(frontendRoot, "src", "environments", "environment.native.ts");

function log(msg) {
  console.log("[publish:native]", msg);
}

function pickJdkHome() {
  const roots = [
    process.env.JAVA_HOME,
    path.join(process.env.LOCALAPPDATA || "", "Eclipse Adoptium"),
    "C:\\Program Files\\Eclipse Adoptium",
  ].filter(Boolean);
  const found = [];
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    try {
      const names = fs.statSync(root).isDirectory()
        ? fs.readdirSync(root).filter((name) => /^jdk-?\d/i.test(name) || /^jdk-\d/i.test(name))
        : [];
      if (fs.existsSync(path.join(root, "bin", "java.exe")) || fs.existsSync(path.join(root, "bin", "java"))) {
        found.push(root);
      }
      for (const name of names) found.push(path.join(root, name));
    } catch {
      /* ignore */
    }
  }
  const withBin = found.filter((dir) => fs.existsSync(path.join(dir, "bin", "java.exe")) || fs.existsSync(path.join(dir, "bin", "java")));
  withBin.sort((a, b) => {
    const ver = (p) => {
      const m = String(p).match(/jdk-?(\d+)/i);
      return m ? Number(m[1]) : 0;
    };
    return ver(b) - ver(a);
  });
  return withBin[0] || null;
}

function ensureAndroidEnv() {
  const jdk = pickJdkHome();
  if (jdk) process.env.JAVA_HOME = jdk;
  if (!process.env.ANDROID_HOME) {
    const localSdk = path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
    if (localSdk && fs.existsSync(localSdk)) process.env.ANDROID_HOME = localSdk;
  }
  if (process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
    process.env.ANDROID_SDK_ROOT = process.env.ANDROID_HOME;
  }
  if (process.env.JAVA_HOME) {
    process.env.PATH = path.join(process.env.JAVA_HOME, "bin") + path.delimiter + process.env.PATH;
    log("JAVA_HOME=" + process.env.JAVA_HOME);
  }
  if (process.env.ANDROID_HOME) log("ANDROID_HOME=" + process.env.ANDROID_HOME);
}

function run(command, args, cwd, allowFail) {
  log((command + " " + args.join(" ")).trim());
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    if (allowFail) {
      log("skipped (exit " + result.status + ")");
      return false;
    }
    throw new Error(command + " failed with exit " + result.status);
  }
  return true;
}

function formatBytes(bytes) {
  if (!bytes) return 0;
  return bytes;
}

function copyIfExists(from, to) {
  if (!from || !fs.existsSync(from)) return null;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  const stat = fs.statSync(to);
  log("copied " + from + " -> " + to + " (" + stat.size + " bytes)");
  return { size: stat.size, updatedAt: new Date().toISOString() };
}

function applyNativeApiUrl() {
  const origin = (process.env.NATIVE_API_URL || process.env.PUBLIC_URL || "").trim().replace(/\/$/, "");
  if (!origin || origin.includes("YOUR_DOMAIN")) {
    log("NATIVE_API_URL / PUBLIC_URL not set to a live host. APK/Electron will keep environment.native.ts as-is.");
    return;
  }
  const apiUrl = origin.endsWith("/api") ? origin : origin + "/api";
  const next =
    "export const environment = {\n" +
    "  production: true,\n" +
    "  apiUrl: " +
    JSON.stringify(apiUrl) +
    ",\n" +
    "};\n";
  fs.writeFileSync(envFile, next);
  log("set native apiUrl to " + apiUrl);
}

function findLatest(dir, match) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((name) => match.test(name))
    .map((name) => {
      const full = path.join(dir, name);
      return { full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return files[0] ? files[0].full : null;
}

function writeManifest(android, windows, pkgVersion) {
  const manifest = {
    updatedAt: new Date().toISOString(),
    android: android
      ? { available: true, version: pkgVersion, size: formatBytes(android.size), updatedAt: android.updatedAt, file: "android.apk" }
      : { available: false },
    windows: windows
      ? { available: true, version: pkgVersion, size: formatBytes(windows.size), updatedAt: windows.updatedAt, file: "windows.exe" }
      : { available: false },
    ios: { available: false },
  };
  fs.mkdirSync(backendPublic, { recursive: true });
  fs.writeFileSync(path.join(backendPublic, "manifest.json"), JSON.stringify(manifest, null, 2));
  const distPublic = path.join(repoRoot, "sunrise-backend", "dist", "public", "downloads", "latest");
  fs.mkdirSync(distPublic, { recursive: true });
  fs.writeFileSync(path.join(distPublic, "manifest.json"), JSON.stringify(manifest, null, 2));
  if (android) {
    const apk = path.join(backendPublic, "android.apk");
    if (fs.existsSync(apk)) fs.copyFileSync(apk, path.join(distPublic, "android.apk"));
  }
  if (windows) {
    const exe = path.join(backendPublic, "windows.exe");
    if (fs.existsSync(exe)) fs.copyFileSync(exe, path.join(distPublic, "windows.exe"));
  }
  log("wrote manifest.json");
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(frontendRoot, "package.json"), "utf8"));
  ensureAndroidEnv();
  applyNativeApiUrl();

  run("npm", ["run", "build:native"], frontendRoot, false);

  let android = null;
  const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  const androidDir = path.join(frontendRoot, "android");
  if (fs.existsSync(path.join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew"))) {
    const ok = run(gradlew, ["assembleDebug"], androidDir, true);
    if (ok) {
      android = copyIfExists(
        path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
        path.join(backendPublic, "android.apk"),
      );
    }
  } else {
    log("Android project / Gradle wrapper not found.");
  }

  let windows = null;
  const electronOk = run("npx", ["electron-builder", "--win", "nsis"], frontendRoot, true);
  if (electronOk) {
    const releaseDir = path.join(frontendRoot, "release");
    const exe = findLatest(releaseDir, /\.exe$/i);
    windows = copyIfExists(exe, path.join(backendPublic, "windows.exe"));
  }

  writeManifest(android, windows, pkg.version);
  log("restoring production web build (baseHref /app/) so public/app is not replaced by the native bundle");
  run("npm", ["run", "build"], frontendRoot, false);
  if (!android && !windows) {
    log("No binaries were produced. Download page will show Coming soon until a build succeeds.");
  }
}

main();
