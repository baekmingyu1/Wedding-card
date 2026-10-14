import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "assets", "gallery");
const outputDir = join(sourceDir, "web");
const shareDir = join(root, "assets", "share");
const originals = (await readdir(sourceDir)).filter((name) => /\.jpe?g$/i.test(name)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
if (!originals.length) throw new Error("assets/gallery에 원본 JPG가 없습니다.");
await mkdir(outputDir, { recursive: true });
await mkdir(shareDir, { recursive: true });

const exists = async (path) => { try { await access(path); return true; } catch { return false; } };
const photos = [];
let wideSource;
for (const [index, name] of originals.entries()) {
  const source = join(sourceDir, name);
  const input = await readFile(source);
  const metadata = await sharp(input).metadata();
  if (!wideSource || metadata.width >= metadata.height) wideSource = input;
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 10);
  const paths = [];
  for (const width of [640, 1200]) {
    const file = `${String(index + 1).padStart(2, "0")}-${width}-${hash}.webp`;
    const target = join(outputDir, file);
    if (!await exists(target)) {
      await sharp(input).rotate().resize({ width, withoutEnlargement: true })
        .webp({ quality: width === 640 ? 76 : 80, effort: 4 }).toFile(target);
    }
    paths.push(`assets/gallery/web/${file}`);
  }
  const dimensions = await sharp(join(root, paths[1])).metadata();
  photos.push({
    src: paths[1],
    srcset: `${paths[0]} 640w, ${paths[1]} 1200w`,
    width: dimensions.width,
    height: dimensions.height
  });
  console.log(`Gallery ${index + 1}/${originals.length}`);
}
await writeFile(join(root, "gallery-images.js"), `window.GALLERY_IMAGES = ${JSON.stringify(photos, null, 2)};\n`);
if (wideSource) {
  await sharp(wideSource).rotate().resize(1200, 630, { fit: "cover", position: "centre" })
    .jpeg({ quality: 84, mozjpeg: true }).toFile(join(shareDir, "kakao-thumbnail.jpg"));
}
console.log(`Generated ${photos.length} gallery photos and social thumbnail.`);
