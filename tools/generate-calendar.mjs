import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const calendarTime = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const escapeText = (value) => String(value).replace(/\\/g, "\\\\")
  .replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
const foldLine = (line) => {
  let folded = "";
  let octets = 0;
  for (const character of line) {
    const length = Buffer.byteLength(character, "utf8");
    if (octets + length > 75) { folded += "\r\n "; octets = 1; }
    folded += character;
    octets += length;
  }
  return folded;
};

export function createCalendar(content, stamp = calendarTime(new Date())) {
  const date = content.eventDate && new Date(content.eventDate);
  // A static file must not depend on the build machine's local timezone.
  if (!date || Number.isNaN(date.getTime()) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(content.eventDate)) {
    throw new Error("일정 파일을 만들려면 eventDate에 시간대가 포함된 날짜가 필요합니다.");
  }
  if (!/^\d{8}T\d{6}Z$/.test(stamp)) throw new Error("일정 파일의 DTSTAMP가 올바르지 않습니다.");
  const start = calendarTime(date);
  const description = [
    `예식 시작: ${content.date} (대한민국 / Asia/Seoul)`,
    "종료 시간은 안내되지 않았습니다. 저장 전 확인해 주세요."
  ].join("\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wedding Card//Wedding Calendar//KO",
    "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:wedding-${start}-${encodeURIComponent(content.couple)}`,
    `DTSTAMP:${stamp}`, `DTSTART:${start}`,
    // No DTEND/DURATION: preserve the existing start-only event.
    `SUMMARY:${escapeText(`${content.couple} 결혼식`)}`,
    `LOCATION:${escapeText([content.venue, content.address].filter(Boolean).join(" · "))}`,
    `DESCRIPTION:${escapeText(description)}`, "END:VEVENT", "END:VCALENDAR"
  ].map(foldLine).join("\r\n") + "\r\n";
}

export async function readCalendarContent() {
  const sandbox = { window: {} };
  runInNewContext(await readFile(join(root, "content.js"), "utf8"), sandbox);
  return sandbox.window.WEDDING_CONTENT;
}

export async function generateCalendar() {
  const content = await readCalendarContent();
  const path = join(root, "wedding.ics");
  let previous = "";
  try { previous = await readFile(path, "utf8"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const stamp = previous.match(/^DTSTAMP:(\d{8}T\d{6}Z)\r?$/m)?.[1];
  // Rebuilding unchanged content keeps the file and its modification time stable.
  if (stamp && previous === createCalendar(content, stamp)) return;
  await writeFile(path, createCalendar(content));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateCalendar();
  console.log("Calendar file: wedding.ics");
}
