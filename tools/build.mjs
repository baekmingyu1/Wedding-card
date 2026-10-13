import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { generateCalendar } from "./generate-calendar.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
if (!output.startsWith(root + sep)) throw new Error("출력 폴더가 프로젝트 밖에 있습니다.");
await generateCalendar();
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(root, "wedding.ics"), join(output, "wedding.ics"));
await cp(join(root, "assets"), join(output, "assets"), {
  recursive: true,
  filter: (source) => {
    const path = relative(root, source).replaceAll("\\", "/");
    return !/^assets\/(?:opening\/DSC\d+\.jpg|gallery\/[^/]+\.jpe?g)$/i.test(path);
  }
});

const assetNames = ["styles.css", "play-pause.css", "opening-images.js", "gallery-images.js", "content.js", "script.js"];
const renamed = new Map();
for (const name of assetNames) {
  const bytes = await readFile(join(root, name));
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
  const extension = extname(name);
  const outputName = `${name.slice(0, -extension.length)}.${hash}${extension}`;
  await writeFile(join(output, outputName), bytes);
  renamed.set(name, outputName);
}

let html = await readFile(join(root, "index.html"), "utf8");
for (const [name, outputName] of renamed) {
  const escaped = name.replaceAll(".", "\\.");
  const pattern = new RegExp(`(["'])${escaped}(?:\\?v=\\d+)?\\1`, "g");
  if (!pattern.test(html)) throw new Error(`index.html에서 ${name} 참조를 찾을 수 없습니다.`);
  html = html.replace(pattern, `"${outputName}"`);
}
await writeFile(join(output, "index.html"), html);
console.log(`Static deployment output: ${output}`);
