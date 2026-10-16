import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

const current = readFileSync(new URL("../script.js", import.meta.url), "utf8");
function harness(source) {
  const elements = new Map();
  const timers = new Map();
  const scripts = [];
  let timerId = 0;
  let constructions = 0;
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      hidden: false, dataset: {}, style: {}, listeners: {}, href: "https://naver.me/example",
      setAttribute() {}, focus() {},
      addEventListener(type, fn) { this.listeners[type] = fn; }
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    content: { naverMapKeyId: "test", naverMapCenter: "127.039411,37.508679", venue: "Venue" },
    location: { protocol: "https:" }, URLSearchParams,
    console: { warn() {}, error() {} },
    clearTimeout: id => timers.delete(id),
    document: { getElementById: element, createElement: () => ({ outerHTML: "<span>Venue</span>" }), head: { append: s => scripts.push(s) } }
  });
  context.window = context;
  context.setTimeout = (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; };
  const start = source.indexOf("  function initVenueMap() {");
  const end = source.indexOf("  const rsvpForm", start);
  assert(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), context);
  return {
    context, element, sdk: scripts[0],
    get constructions() { return constructions; },
    tick(ms) { for (const [id, timer] of [...timers]) if (timer.ms === ms && timers.delete(id)) timer.fn(); },
    exportSdk() {
      context.naver = { maps: {
        LatLng: class {}, Point: class {},
        Map: class { constructor() { constructions++; } setOptions(options) { element("venue-map-canvas").options = options; } destroy() {} },
        Marker: class { setMap() {} }, Event: { once() {} }
      } };
    }
  };
}

// Reproduce the previous permanent fallback when callback precedes the namespace export.
if (process.argv.includes("--compare-head")) {
  const previous = execFileSync("git", ["show", "HEAD:script.js"], { encoding: "utf8" });
  const old = harness(previous);
  old.context.initWeddingVenueMap();
  old.exportSdk();
  old.sdk.onload();
  assert.equal(old.element("venue-map").dataset.state, "fallback");
  assert.equal(old.constructions, 0);
}

const early = harness(current);
early.context.initWeddingVenueMap();
assert.equal(early.element("venue-map").dataset.state, "loading");
early.exportSdk();
early.sdk.onload();
early.tick(0);
assert.equal(early.element("venue-map").dataset.state, "ready");
assert.equal(early.constructions, 1);
early.element("venue-map-activate").listeners.click();
assert.equal(early.element("venue-map-canvas").inert, false);
assert.equal(early.element("venue-map-canvas").options.draggable, true);
early.element("venue-map-lock").listeners.click();
assert.equal(early.element("venue-map-canvas").inert, true);
early.context.initWeddingVenueMap();
early.tick(0);
assert.equal(early.constructions, 1);

const delayed = harness(current);
delayed.context.initWeddingVenueMap();
delayed.tick(0);
assert.equal(delayed.element("venue-map").dataset.state, "loading");
delayed.exportSdk();
delayed.tick(100);
assert.equal(delayed.element("venue-map").dataset.state, "ready");

for (const failure of ["timeout", "network", "auth"]) {
  const test = harness(current);
  if (failure === "timeout") test.tick(20000);
  if (failure === "network") test.sdk.onerror();
  if (failure === "auth") test.context.navermap_authFailure();
  assert.equal(test.element("venue-map").dataset.state, "fallback");
  test.exportSdk();
  test.context.initWeddingVenueMap();
  test.tick(0);
  assert.equal(test.constructions, 0);
}
console.log("PASS: early callback, delayed SDK export, single construction, interaction controls, timeout/network/auth fallback");
