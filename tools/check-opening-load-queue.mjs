import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../script.js", import.meta.url), "utf8");
const flush = () => new Promise((resolve) => setImmediate(resolve));

async function simulate(app, { pendingDecode = false, failed = -1, stalled = -1, skip = false } = {}) {
  const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
  let now = 0, nextTimer = 0, inFlight = 0, maxInFlight = 0, requested = 0;
  const timers = new Map();
  const setTimer = (fn, delay) => {
    const id = ++nextTimer;
    timers.set(id, { at: now + delay, fn });
    return id;
  };
  const clearTimer = (id) => timers.delete(id);
  class Element extends EventTarget {
    constructor(tag) {
      super();
      this.tag = tag;
      this.children = [];
      this.dataset = {};
      this.style = { setProperty() {} };
      this.classList = { add() {}, remove() {} };
      this.complete = false;
      this.naturalWidth = 0;
    }
    append(child) { this.children.push(child); child.parent = this; }
    remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
    querySelector(selector) {
      for (const child of this.children) {
        if ((selector === "img" && child.tag === "img") ||
            (selector === "img[data-src]" && child.tag === "img" && child.dataset.src) ||
            (selector === ".opening__placeholder" && child.className === "opening__placeholder")) return child;
        const found = child.querySelector(selector);
        if (found) return found;
      }
      return null;
    }
    set src(value) {
      this.currentSrc = value;
      const index = Number(value.split(".")[0]);
      requested++;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if (index === stalled) return;
      setTimer(() => {
        inFlight--;
        this.complete = true;
        this.naturalWidth = index === failed ? 0 : 1024;
        this.dispatchEvent(new Event(index === failed ? "error" : "load"));
      }, 10);
    }
    decode() { return pendingDecode ? new Promise(() => {}) : Promise.resolve(); }
  }
  const context = {
    Event, setTimeout: setTimer, clearTimeout: clearTimer,
    window: { setTimeout: setTimer, clearTimeout: clearTimer },
    document: { createElement: (tag) => new Element(tag) },
    scheduleUpdate() {},
    frames: [], loadQueue: [], frameRequests: new Map(),
    activeLoads: 0, loadsEnabled: true, maxConcurrentLoads: 3,
    loaderCount: {}, loaderProgress: { style: {} }
  };
  runInNewContext(
    between("  const photoUrl =", "  const openingPhotos =") +
    between("  function loadOpeningFrame(", "  function keepPreviousUntilCovered(") +
    between("  function requestOpeningFrame(", "  function finishOpening(") +
    between("  async function prepareOpeningFrames(", "  async function playOpening("),
    context
  );
  const host = new Element("div");
  for (let index = 0; index < 15; index++) context.addPhoto(host, `${index}.webp`, index, "opening");
  context.frames = host.children;
  let done = false;
  const preparation = context.prepareOpeningFrames(() => context.loadsEnabled).then(() => { done = true; });
  if (skip) setTimer(() => context.stopPendingOpeningLoads(), 5);
  let turns = 0;
  while (!done) {
    await flush();
    if (done) break;
    assert.ok(timers.size, "preparation must have a bounded way to settle");
    assert.ok(++turns < 100, "queue must make progress");
    now = Math.min(...[...timers.values()].map((timer) => timer.at));
    for (const [id, timer] of [...timers]) {
      if (timer.at > now || !timers.has(id)) continue;
      timers.delete(id);
      timer.fn();
    }
  }
  await preparation;
  return { elapsed: now, requested, maxInFlight, context };
}

const normal = await simulate(source);
assert.equal(normal.elapsed, 50, "15 downloads at 10ms with 3 slots need five batches");
assert.equal(normal.maxInFlight, 3, "download concurrency stays bounded");
const pending = await simulate(source, { pendingDecode: true });
assert.equal(pending.elapsed, 1250, "decode fallback overlaps later downloads instead of delaying each batch");
assert.equal(pending.requested, 15);
assert.equal(pending.maxInFlight, 3);
assert.equal(pending.context.activeLoads, 0);
assert.ok(pending.context.frames.every((frame) => frame.dataset.status === "ready"));
assert.equal(pending.context.loaderCount.textContent, "15 / 15");
for (const options of [{ failed: 2 }, { stalled: 2 }]) {
  const result = await simulate(source, options);
  assert.equal(result.context.frames[2].dataset.status, "failed");
  assert.equal(result.context.activeLoads, 0, "errors and timeouts release each slot once");
  assert.equal(result.requested, 15);
}
const skipped = await simulate(source, { pendingDecode: true, skip: true });
assert.equal(skipped.requested, 3, "skip prevents queued downloads from starting");
assert.equal(skipped.context.activeLoads, 0);
assert.equal(skipped.context.frameRequests.size, 0);
if (process.argv[2]) {
  const previous = await simulate(await readFile(process.argv[2], "utf8"), { pendingDecode: true });
  console.log(`Simulated identical 10ms downloads and non-settling decode: ${previous.elapsed}ms before → ${pending.elapsed}ms after.`);
}
console.log("PASS: real photo load handlers and queue, bounded downloads, overlapping decode fallback, all-photo readiness, errors, timeout and skip cancellation.");
