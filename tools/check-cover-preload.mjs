import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../script.js", import.meta.url), "utf8");
const preparation = source.slice(source.indexOf("  async function prepareOpeningFrames("), source.indexOf("  async function playOpening("));
const cover = source.slice(source.indexOf("  function finishCoverOpening("), source.lastIndexOf("})();"));
const skip = source.slice(source.indexOf("  function skipOpening("), source.indexOf('  document.querySelector(".skip-link").addEventListener("click", skipOpening)'));
const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup({ reduced = false, deep = false, animate = true, decoded = true, cached = false } = {}) {
  const timers = new Map();
  const jobs = new Map();
  const calls = { music: 0, replay: 0, navigate: 0, stopped: 0, animations: [] };
  function element() {
    const listeners = new Map();
    const classes = new Set();
    return {
      hidden: false, style: {}, scrollTop: 0, attributes: {},
      classList: { add: (x) => classes.add(x), remove: (x) => classes.delete(x) },
      addEventListener: (type, listener) => listeners.set(type, listener),
      dispatch: (type, event = { preventDefault() {} }) => listeners.get(type)?.(event),
      append(...children) { for (const child of children) child.parentElement = this; },
      prepend(...children) { this.append(...children); },
      setAttribute(key, value) { this.attributes[key] = value; },
      getBoundingClientRect: () => ({ left: 30, top: 160, width: 250, height: 190 }),
      showModal() { this.open = true; },
      close() { this.open = false; },
      focus() {}
    };
  }
  const names = ["coverDialog", "coverPhoto", "coverReveal", "coverButton", "coverHint",
    "openingStage", "openingVeil", "frameHost", "bgmButton", "skipButton", "openingLoader"];
  const context = Object.fromEntries(names.map((name) => [name, element()]));
  context.frameHost.parentElement = context.openingStage;
  context.coverReveal.hidden = true;
  context.coverDialog.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 844 });
  if (animate) context.coverReveal.animate = (frames) => {
    const animation = { frames, cancel() { this.cancelled = true; } };
    calls.animations.push(animation);
    return animation;
  };
  const motion = element();
  motion.matches = reduced;
  Object.assign(context, {
    coverWanted: !deep, coverPending: !deep, coverPreparing: !deep, coverOpening: false,
    coverTimer: undefined, coverExpansion: undefined, autoplayActive: false,
    motionReduced: motion, content: { coverLoading: "준비 중" },
    frames: Array.from({ length: 3 }, () => ({ dataset: { status: cached ? "ready" : "pending" } })),
    loaderCount: {}, loaderProgress: { style: {} },
    document: { documentElement: element() },
    window: {
      setTimeout(fn, ms) { const id = Symbol(); timers.set(id, { fn, ms }); return id; },
      clearTimeout(id) { timers.delete(id); }
    },
    setOpeningLocked(locked) { context.locked = locked; },
    startBgm() { calls.music++; },
    requestOpeningFrame(index) {
      if (context.frames[index].dataset.status === "ready") return Promise.resolve(true);
      if (context.frames[index].dataset.status === "failed") return Promise.resolve(false);
      if (!jobs.has(index)) {
        let resolve;
        const promise = new Promise((done) => { resolve = done; });
        jobs.set(index, { promise, resolve });
      }
      return jobs.get(index).promise;
    },
    decodeOpeningForPlayback: () => Promise.resolve(decoded),
    stopPendingOpeningLoads() { calls.stopped++; },
    preloadGallery() {},
    navigateToInvitation() { calls.navigate++; },
    replayOpening(options) { calls.replay++; calls.options = options; },
    playOpening() {}
  });
  runInNewContext(preparation + skip + cover, context);
  return {
    context, calls, timers,
    click: () => context.coverButton.dispatch("click"),
    settle(index, ready = true) {
      context.frames[index].dataset.status = ready ? "ready" : "failed";
      jobs.get(index)?.resolve(ready);
    },
    run(ms) {
      const timer = [...timers].find(([, value]) => value.ms === ms);
      assert.ok(timer, `timer ${ms}`);
      timers.delete(timer[0]);
      timer[1].fn();
    }
  };
}

for (const reduced of [false, true]) {
  const t = setup({ reduced });
  assert.equal(t.context.coverDialog.open, undefined, "no envelope before preparation");
  t.click();
  assert.equal(t.calls.music, 0, "preparation must not start music");
  t.settle(0);
  await flush();
  assert.equal(t.context.loaderCount.textContent, "01 / 03");
  t.settle(1);
  await flush();
  assert.equal(t.context.coverDialog.open, undefined, "first photo alone is insufficient");
  t.settle(2);
  await flush();
  assert.equal(t.context.loaderProgress.style.width, "100%");
  assert.equal(t.context.coverDialog.open, true);
  assert.equal(t.context.openingLoader.hidden, true);
  assert.equal(t.context.frameHost.parentElement, t.context.coverPhoto);
  assert.equal(t.calls.music, 0);
  t.click();
  assert.equal(t.calls.music, 1, "music starts synchronously in the envelope click");
  t.click();
  await flush();
  assert.equal(t.calls.music, 1, "duplicate clicks are ignored");
  if (!reduced) {
    t.run(1050);
    assert.equal(t.context.frameHost.parentElement, t.context.coverReveal);
    t.calls.animations[0].onfinish();
  }
  assert.equal(t.calls.replay, 1);
  assert.equal(t.context.openingLoader.hidden, true, "no second loader");
  assert.equal(t.context.frameHost.parentElement, t.context.openingStage);
}
{
  const t = setup();
  t.settle(0);
  await flush();
  t.context.skipOpening({ preventDefault() {} });
  t.settle(1);
  t.settle(2);
  await flush();
  assert.equal(t.calls.navigate, 1);
  assert.equal(t.calls.stopped, 1);
  assert.equal(t.context.locked, false);
  assert.equal(t.context.openingLoader.hidden, true);
  assert.equal(t.context.coverDialog.open, false, "late completion cannot reopen the envelope");
  assert.equal(t.calls.music, 0);
}
for (const options of [{}, { animate: false }, { decoded: false }, { cached: true }]) {
  const t = setup(options);
  t.settle(0);
  t.settle(1, false);
  t.settle(2);
  await flush();
  assert.equal(t.context.coverDialog.open, true, "a failed photo keeps the existing fallback");
  t.click();
  await flush();
  if (options.decoded !== false) {
    t.run(1050);
    if (options.animate !== false) t.run(900);
  }
  assert.equal(t.calls.replay, 1, "cached photos, decode failure and animation watchdog finish");
}
for (const phase of ["envelope", "unfolding", "expanding"]) {
  const t = setup({ cached: true });
  await flush();
  if (phase !== "envelope") { t.click(); await flush(); }
  if (phase === "expanding") t.run(1050);
  t.context.coverDialog.dispatch("cancel");
  await flush();
  assert.equal(t.calls.navigate, 1);
  assert.equal(t.calls.replay, 0);
  assert.equal(t.context.frameHost.parentElement, t.context.openingStage);
  assert.equal(t.timers.size, 0);
}
{
  const t = setup({ cached: true });
  await flush();
  t.click();
  await flush();
  t.run(1050);
  t.context.motionReduced.matches = true;
  t.context.motionReduced.dispatch("change");
  assert.equal(t.calls.animations[0].cancelled, true);
  assert.equal(t.calls.replay, 1);
  assert.equal(t.timers.size, 0);
}
{
  const t = setup({ deep: true });
  await flush();
  assert.equal(t.context.coverDialog.open, undefined);
  assert.equal(t.context.frameHost.parentElement, t.context.openingStage);
}
console.log("PASS: all-photo progress before envelope, no early audio, no second loader, reduced motion, skip cancellation, failed/cached photos, animation fallback and deep links.");
