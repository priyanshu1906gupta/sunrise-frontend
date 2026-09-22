/**
 * Rasterize the Sunrise logo into Android launcher mipmaps.
 */
const fs = require("fs");
const path = require("path");

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    sharp = require(path.join(__dirname, "..", "..", "sunrise-backend", "node_modules", "sharp"));
  }

  const logoCandidates = [
    path.join(__dirname, "..", "..", "sunrise-landing page", "images", "logo.png"),
    path.join(__dirname, "..", "..", "sunrise-backend", "public", "images", "logo.png"),
    path.join(__dirname, "..", "src", "assets", "brand", "logo.png"),
    path.join(__dirname, "..", "..", "logo.png"),
  ];
  const logo = logoCandidates.find((p) => fs.existsSync(p));
  if (!logo) throw new Error("logo.png not found");

  const resDir = path.join(__dirname, "..", "android", "app", "src", "main", "res");
  const densities = [
    { folder: "mipmap-mdpi", launcher: 48, foreground: 108 },
    { folder: "mipmap-hdpi", launcher: 72, foreground: 162 },
    { folder: "mipmap-xhdpi", launcher: 96, foreground: 216 },
    { folder: "mipmap-xxhdpi", launcher: 144, foreground: 324 },
    { folder: "mipmap-xxxhdpi", launcher: 192, foreground: 432 },
  ];

  const src = sharp(logo).ensureAlpha();
  const meta = await src.metadata();

  for (const dens of densities) {
    const dir = path.join(resDir, dens.folder);
    fs.mkdirSync(dir, { recursive: true });

    const squareLogo = await sharp(logo)
      .resize(dens.launcher, dens.launcher, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();
    await sharp(squareLogo).toFile(path.join(dir, "ic_launcher.png"));
    await sharp(squareLogo).toFile(path.join(dir, "ic_launcher_round.png"));

    const inset = Math.round(dens.foreground * 0.18);
    const inner = dens.foreground - inset * 2;
    const resized = await sharp(logo)
      .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: dens.foreground,
        height: dens.foreground,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{ input: resized, left: inset, top: inset }])
      .png()
      .toFile(path.join(dir, "ic_launcher_foreground.png"));
  }

  const bgXml = path.join(resDir, "values", "ic_launcher_background.xml");
  fs.writeFileSync(
    bgXml,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n`,
  );

  console.log("Wrote Android launcher icons from", logo, meta.width + "x" + meta.height);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
