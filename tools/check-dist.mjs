import { createHash } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");
const html = await readFile(join(output, "index.html"), "utf8");
const files = await readdir(output);
const assets = ["styles", "play-pause", "opening-images", "content", "script"];
for (const name of assets) {
  const matching = files.filter((file) => file.startsWith(`${name}.`) && /\.[a-f0-9]{10}\.(?:css|js)$/.test(file));
  if (matching.length !== 1) throw new Error(`${name}의 해시 파일 수가 1개가 아닙니다.`);
  const file = matching[0];
  const bytes = await readFile(join(output, file));
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
  if (!file.includes(`.${hash}.`) || !html.includes(`"${file}"`)) {
    throw new Error(`${name} 파일명 또는 HTML 참조가 일치하지 않습니다.`);
  }
}

const manifestName = files.find((file) => /^opening-images\.[a-f0-9]{10}\.js$/.test(file));
const sandbox = { window: {} };
runInNewContext(await readFile(join(output, manifestName), "utf8"), sandbox);
const photos = sandbox.window.OPENING_IMAGES;
if (!Array.isArray(photos) || !photos.length) throw new Error("오프닝 사진 목록이 비었습니다.");
for (const photo of photos) {
  const paths = [photo.src, photo.blur,
    ...photo.srcset.split(", ").map((candidate) => candidate.split(" ")[0]),
    ...photo.mobileSrcset.split(", ").map((candidate) => candidate.split(" ")[0])];
  for (const path of paths) await access(join(output, path));
}
if (!html.includes(photos[0].mobileSrcset) || !html.includes(photos[0].srcset)) {
  throw new Error("첫 사진 preload가 화면 표시 후보와 다릅니다.");
}
if ((await readdir(join(output, "assets", "opening"))).some((name) => /^DSC\d+\.jpg$/i.test(name))) {
  throw new Error("원본 JPG가 배포 폴더에 포함됐습니다.");
}
const mobileBytes = (await Promise.all(photos.map(async (photo) => {
  const candidate = photo.mobileSrcset.split(", ").at(-1).split(" ")[0];
  return (await stat(join(output, candidate))).size;
}))).reduce((sum, size) => sum + size, 0);
console.log(`Checked ${photos.length} photos and hashed assets; 1024px opening total: ${mobileBytes} bytes.`);
