import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../script.js", import.meta.url), "utf8");
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const prepare = between("  function prepareOpeningImage(", "  function addPhoto(");
const decode = between("  function decodeOpeningForPlayback(", "  function updateScroll(");
const replay = between("  function replayOpening(", '  document.querySelectorAll(\'a[href="#opening"]\')');
const play = between("  async function playOpening(", "  // Progressive enhancement:");
const prepareAll = between("  async function prepareOpeningFrames(", "  async function playOpening(");
const update = between("  function updateScroll(", "  function scheduleUpdate(");
const flush = () => new Promise((resolve) => setImmediate(resolve));
const image = (decode = () => Promise.resolve()) => ({
  complete: true, naturalWidth: 768, currentSrc: "photo.webp", decode
});

// Run the production preparation code with controllable decode outcomes and timers.
for (const outcome of ["success", "reject", "throw", "absent", "pending"]) {
  const timers = new Set();
  const context = {
    setTimeout(fn) { timers.add(fn); return fn; },
    clearTimeout(fn) { timers.delete(fn); }
  };
  runInNewContext(prepare, context);
  const img = image({
    success: () => Promise.resolve(),
    reject: () => Promise.reject(new Error("decode unavailable")),
    throw: () => { throw new Error("decode unavailable"); },
    absent: undefined,
    pending: () => new Promise(() => {})
  }[outcome]);
  if (outcome === "absent") delete img.decode;
  const result = context.prepareOpeningImage(img);
  await flush();
  if (outcome === "pending") for (const fn of [...timers]) fn();
  assert.equal(await result, true, `${outcome}: loaded photo remains usable`);
  assert.equal(timers.size, 0, `${outcome}: timer released`);
}
{
  const context = { setTimeout, clearTimeout };
  runInNewContext(prepare, context);
  for (const override of [{ complete: false }, { naturalWidth: 0 }]) {
    assert.equal(await context.prepareOpeningImage({ ...image(), ...override }), false);
  }
  let settle;
  const img = image(() => new Promise((resolve) => { settle = resolve; }));
  const result = context.prepareOpeningImage(img);
  await flush();
  img.currentSrc = "different-photo.webp";
  settle();
  assert.equal(await result, false, "a replaced source must be prepared by its own load");
}

const element = () => ({
  hidden: false, style: { removeProperty() {} },
  classList: { add() {}, remove() {}, toggle() {} },
  setAttribute() {}, removeAttribute() {}, toggleAttribute() {}
});
function playbackContext(reduced = false) {
  const context = {
    setTimeout, clearTimeout,
    frames: Array.from({ length: 3 }, () => ({
      dataset: { status: "ready" },
      querySelector: () => image(() => Promise.reject(new Error("webview decode")))
    })),
    autoplayActive: true, playbackRun: 1, autoplayIndex: 0,
    motionReduced: { matches: reduced }, finalMessageReady: false,
    openingLoader: element(), loaderCount: {}, loaderProgress: { style: {} },
    requestOpeningFrame: () => Promise.resolve(true),
    waitUntilActive: async () => {}, preloadGallery() {}, startBgm() {},
    painted: [], delays: [],
    updateScroll() { context.painted.push(context.autoplayIndex); },
    waitPlayback: async (ms) => { context.delays.push(ms); },
    finishOpening() { context.autoplayActive = false; context.finished = true; }
  };
  runInNewContext(prepare + decode + prepareAll + play, context);
  return context;
}
for (const reduced of [false, true]) {
  const context = playbackContext(reduced);
  await context.playOpening(1);
  assert.deepEqual(context.painted, [0, 1, 2, 2], "decode rejection must not skip loaded photos");
  assert.ok(context.delays.includes(reduced ? 1800 : 200), "reduced-motion autoplay uses slow stills");
  assert.equal(context.finished, true);
}
{
  const context = playbackContext();
  let release;
  context.requestOpeningFrame = (index) => index === 2
    ? new Promise((resolve) => { release = resolve; }) : Promise.resolve(true);
  const playing = context.playOpening(1);
  await flush();
  assert.equal(context.painted.length, 0, "all photos prepare before playback");
  context.autoplayActive = false;
  context.playbackRun += 1;
  release(true);
  await playing;
  assert.equal(context.painted.length, 0, "skipping during loading cancels the old run");
}
for (const [reduce, pending] of [
  [true, false], [true, true], [false, true], [false, false]
]) {
  const context = {
    galleryDialog: { open: false }, opening: element(), openingLoader: element(),
    bgmStarted: true, playBgm() {}, startBgm() {}, playbackRun: 0,
    cancelFrameCleanup() {}, motionReduced: { matches: reduce },
    pumpOpeningLoads() {}, frames: [{ dataset: { status: pending ? "loading" : "ready" } }],
    setOpeningLocked(locked) { context.locked = locked; },
    document: { documentElement: { style: {} } }, window: { scrollTo() {} },
    location: { hash: "#opening" }, requestOpeningFrame() {}, updateScroll() {},
    playOpening() { context.played = true; }, preloadGallery() {}
  };
  runInNewContext(replay, context);
  context.replayOpening({ fromCover: true });
  assert.equal(context.autoplayActive, true);
  assert.equal(context.locked, true);
  assert.equal(context.played, true, "opening the envelope starts playback without a second tap");
  assert.equal(context.openingLoader.hidden, true,
    "cover handoff never shows a second loader");
  context.replayOpening();
  assert.equal(context.openingLoader.hidden, !pending,
    "a direct replay can still prepare photos if the initial loader was skipped");
}
{
  const context = playbackContext();
  context.waitPlayback = async (ms) => {
    context.delays.push(ms);
    if (ms === 1300) context.motionReduced.matches = true;
  };
  await context.playOpening(1);
  assert.deepEqual(context.painted, [0, 1, 2, 2]);
  assert.ok(context.delays.includes(1800), "preference changes slow subsequent stills without stopping");
  assert.equal(context.finished, true);
}
// Exercise the actual renderer: advancing the playback index must also change
// the visible photo when reduced motion is enabled, including its final caption.
{
  const context = {
    openingLocked: true, photoDialogActive: false, photoHistoryPending: false,
    photoRestorePending: false, playbackComplete: false, hasLeftOpening: false,
    autoplayActive: true, autoplayIndex: 1, paintedScene: 0, frameLayer: 1,
    motionReduced: { matches: true }, finalMessageReady: false,
    window: { scrollY: 0, innerHeight: 800 },
    opening: { offsetHeight: 800, getBoundingClientRect: () => ({ top: 0, bottom: 800 }) },
    firstSection: { getBoundingClientRect: () => ({ top: 800 }) }, sections: [],
    document: { documentElement: { scrollHeight: 6000 } }, links: [],
    frames: Array.from({ length: 3 }, () => ({ ...element(), dataset: { status: "ready" } })),
    openingCount: {}, openingCopy: element(), openingFinal: element(),
    openingProgress: element(), sideNav: element(), navProgress: element(),
    keepPreviousUntilCovered() {}
  };
  runInNewContext(update, context);
  context.updateScroll();
  assert.equal(context.paintedScene, 1, "reduced motion must not pin scene zero");
  assert.equal(context.frames[1].style.visibility, "visible");
  assert.equal(context.openingCopy.style.opacity, "0");
  context.autoplayIndex = 2;
  context.finalMessageReady = true;
  let finalVisible;
  context.openingFinal.classList.toggle = (_, visible) => { finalVisible = visible; };
  context.updateScroll();
  assert.equal(context.paintedScene, 2);
  assert.equal(finalVisible, true);
}
console.log("PASS: decode fallback/timeout, broken and replaced sources, automatic photo progression with reduced motion, runtime preference changes, all-frame preparation, cancellation and cover loading feedback.");
