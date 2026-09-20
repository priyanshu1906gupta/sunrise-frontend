/**
 * After `npx cap add android` / `npx cap add ios`, apply screenshot protection.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function walk(dir, match, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, found);
    else if (match.test(entry.name)) found.push(full);
  }
  return found;
}

function patchAndroid() {
  const files = walk(path.join(root, "android"), /MainActivity\.(java|kt)$/);
  for (const file of files) {
    let src = fs.readFileSync(file, "utf8");
    if (src.includes("FLAG_SECURE")) continue;
    if (file.endsWith(".kt")) {
      if (!src.includes("android.view.WindowManager")) {
        src = src.replace("import android.os.Bundle", "import android.os.Bundle\nimport android.view.WindowManager");
      }
      src = src.replace(
        /super\.onCreate\([^\)]*\)/,
        (m) => `${m}\n        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)`,
      );
    } else {
      if (!src.includes("android.view.WindowManager")) {
        src = src.replace("import android.os.Bundle;", "import android.os.Bundle;\nimport android.view.WindowManager;");
      }
      src = src.replace(
        /super\.onCreate\([^\)]*\);/,
        (m) => `${m}\n        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);`,
      );
    }
    fs.writeFileSync(file, src);
    console.log("Patched FLAG_SECURE in", path.relative(root, file));
  }
}

function patchIos() {
  const files = walk(path.join(root, "ios"), /AppDelegate\.swift$/);
  for (const file of files) {
    let src = fs.readFileSync(file, "utf8");
    if (src.includes("userDidTakeScreenshotNotification")) continue;
    if (!src.includes("import UIKit")) src = "import UIKit\n" + src;
    const snippet = `
    func installScreenshotOverlay() {
        NotificationCenter.default.addObserver(forName: UIApplication.userDidTakeScreenshotNotification, object: nil, queue: .main) { _ in
            guard let window = self.window else { return }
            let overlay = UIView(frame: window.bounds)
            overlay.backgroundColor = UIColor.black
            overlay.tag = 884420
            window.addSubview(overlay)
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                window.viewWithTag(884420)?.removeFromSuperview()
            }
        }
    }
`;
    src = src.replace(/func application\([^\)]*didFinishLaunchingWithOptions[^{]+\{/, (m) => `${m}\n        installScreenshotOverlay()`);
    src += "\n" + snippet;
    fs.writeFileSync(file, src);
    console.log("Patched iOS screenshot overlay in", path.relative(root, file));
  }
}

patchAndroid();
patchIos();
