(() => {
  "use strict";

  const content = window.WEDDING_CONTENT;
  if (!content) return;

  const motionReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const frameHost = document.getElementById("opening-frames");
  const galleryHost = document.getElementById("gallery-grid");
  const accountHost = document.getElementById("account-list");
  const toast = document.getElementById("toast");
  let toastTimer;

  document.querySelectorAll("[data-field]").forEach((element) => {
    element.textContent = content[element.dataset.field] || "";
  });

  for (const line of content.invitation || []) {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    document.getElementById("invitation-message").append(paragraph);
  }

  function addPhoto(host, path, index, kind) {
    const wrapper = document.createElement(kind === "opening" ? "div" : "figure");
    wrapper.className = kind === "opening"
      ? "opening__frame opening__frame--fallback"
      : "gallery__item";
    if (kind === "opening") wrapper.dataset.status = path ? "loading" : "failed";

    const placeholder = document.createElement("span");
    placeholder.className = kind === "opening" ? "opening__placeholder" : "gallery__placeholder";
    placeholder.textContent = kind === "opening"
      ? `SCENE ${String(index + 1).padStart(2, "0")} · ${path ? "불러오는 중" : "사진 준비 중"}`
      : `PHOTO ${String(index + 1).padStart(2, "0")}`;
    wrapper.append(placeholder);

    if (path) {
      const img = document.createElement("img");
      const openingAlternatives = kind === "opening"
        ? [...new Set([
            path,
            path.split("?")[0],
            content.openingPhotos?.[index - 1]?.split("?")[0]
          ].filter(Boolean))]
        : [];
      let sourceIndex = 0;
      img.hidden = true;
      img.decoding = "async";
      img.alt = kind === "opening" ? "" : `두 사람의 사진 ${index + 1}`;
      if (kind === "gallery") img.loading = "lazy";
      if (kind === "opening") img.fetchPriority = index === 0 ? "high" : "low";
      img.addEventListener("load", () => {
        if (kind === "opening") {
          const photoUrl = new URL(img.currentSrc || img.src, document.baseURI).href;
          wrapper.style.setProperty("--frame-image", `url(${JSON.stringify(photoUrl)})`);
        }
        img.hidden = false;
        placeholder.remove();
        wrapper.classList.remove("opening__frame--fallback");
        if (kind === "opening") {
          wrapper.dataset.status = "ready";
          wrapper.dispatchEvent(new Event("frame-settled"));
        }
      });
      img.addEventListener("error", () => {
        if (kind !== "opening") return;
        if (sourceIndex + 1 < openingAlternatives.length) {
          img.src = openingAlternatives[++sourceIndex];
          return;
        }
        placeholder.textContent = `SCENE ${String(index + 1).padStart(2, "0")} · 사진을 불러올 수 없습니다`;
        wrapper.dataset.status = "failed";
        wrapper.dispatchEvent(new Event("frame-settled"));
      });
      if (kind === "opening") img.dataset.src = path;
      else img.src = path;
      wrapper.append(img);
    }
    host.append(wrapper);
  }

  const openingPhotos = (content.openingPhotos || []).filter(Boolean);
  if (!openingPhotos.length) openingPhotos.push("");
  openingPhotos.forEach((path, index) => addPhoto(frameHost, path, index, "opening"));

  const editorialPhotos = {
    last: openingPhotos[openingPhotos.length - 1],
    middle: openingPhotos[Math.floor((openingPhotos.length - 1) / 2)]
  };
  document.querySelectorAll("[data-editorial-photo]").forEach((image) => {
    const path = editorialPhotos[image.dataset.editorialPhoto];
    if (!path) return;
    image.addEventListener("error", () => { image.hidden = true; });
    image.src = path;
    image.hidden = false;
  });

  const galleryPhotos = content.galleryPhotos?.length ? content.galleryPhotos : Array(6).fill("");
  galleryPhotos.forEach((path, index) => {
    const fallbackIndex = Math.round(index * (openingPhotos.length - 1) / Math.max(1, galleryPhotos.length - 1));
    addPhoto(galleryHost, path || openingPhotos[fallbackIndex], index, "gallery");
  });
  document.querySelector(".section__count").textContent = `01 — ${String(galleryPhotos.length).padStart(2, "0")}`;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  async function copyText(value) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement("textarea");
        input.value = value;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.append(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        if (!copied) throw new Error("copy failed");
      }
      showToast("복사되었습니다.");
    } catch {
      showToast("복사할 수 없습니다. 내용을 직접 선택해 주세요.");
    }
  }

  const isReady = (value) => Boolean(value && !value.includes("입력해 주세요"));
  const addressButton = document.getElementById("copy-address");
  if (isReady(content.address)) {
    addressButton.disabled = false;
    addressButton.addEventListener("click", () => copyText(content.address));
  }

  if (content.mapUrl) {
    try {
      const mapUrl = new URL(content.mapUrl);
      if (["https:", "http:"].includes(mapUrl.protocol)) {
        const mapLink = document.getElementById("map-link");
        mapLink.href = mapUrl.href;
        mapLink.hidden = false;
      }
    } catch { /* Keep the map link hidden until a valid URL is supplied. */ }
  }

  for (const account of content.accounts || []) {
    const card = document.createElement("article");
    card.className = "account__card";
    const side = document.createElement("p");
    side.className = "account__side";
    side.textContent = account.side;
    const details = document.createElement("p");
    details.className = "account__details";
    const name = document.createElement("strong");
    const ready = Boolean(account.bank && account.number && account.holder);
    name.textContent = ready ? `${account.bank} ${account.number}` : "계좌 정보 준비 중";
    details.append(name);
    if (ready) details.append(document.createTextNode(`예금주 ${account.holder}`));
    const button = document.createElement("button");
    button.className = "button button--light";
    button.type = "button";
    button.textContent = "계좌번호 복사 ↗";
    button.disabled = !ready;
    if (ready) button.addEventListener("click", () => copyText(account.number));
    card.append(side, details, button);
    accountHost.append(card);
  }
  if ((content.accounts || []).some((account) => account.bank && account.number && account.holder)) {
    document.querySelector(".account__note").hidden = true;
  }

  const opening = document.getElementById("opening");
  const frames = [...frameHost.children];
  const openingCopy = document.querySelector(".opening__copy");
  const openingFinal = document.getElementById("opening-final");
  const openingCount = document.getElementById("opening-count");
  const openingProgress = document.getElementById("opening-progress");
  const openingStatus = document.getElementById("opening-status");
  const pauseButton = document.getElementById("opening-pause");
  const skipButton = document.getElementById("opening-skip");
  const sections = ["opening", "contents", "story", "invitation", "gallery", "location", "account"]
    .map((id) => document.getElementById(id));
  const contents = document.getElementById("contents");
  const sideNav = document.querySelector(".side-nav");
  const navProgress = document.getElementById("nav-progress");
  const links = [...document.querySelectorAll("[data-nav]")];
  const startAtOpening = window.scrollY < 10 && (!location.hash || location.hash === "#opening");
  let autoplayActive = startAtOpening && !motionReduced.matches;
  let playbackComplete = false;
  let autoplayIndex = 0;
  let playbackPaused = false;
  let playbackRun = 0;
  let hasLeftOpening = false;
  let paintedScene = -1;
  let pending = false;

  if (autoplayActive || motionReduced.matches) {
    opening.classList.add("opening--short");
  } else {
    // Keep the original scroll-driven sequence for deep links and restored scroll positions.
    opening.style.setProperty("--sequence-height", `${Math.max(300, 170 + openingPhotos.length * 22)}svh`);
    openingStatus.textContent = "SCROLL TO MEET ↓";
  }
  if (autoplayActive) document.body.classList.add("opening-locked");
  if (motionReduced.matches) openingStatus.textContent = "아래로 스크롤 ↓";

  function loadOpeningFrame(index, highPriority = false) {
    const image = frames[index]?.querySelector("img[data-src]");
    if (!image) return;
    if (highPriority) image.fetchPriority = "high";
    image.src = image.dataset.src;
    delete image.dataset.src;
  }

  function updateScroll() {
    pending = false;
    if (playbackComplete && hasLeftOpening && window.scrollY < 5) {
      replayOpening();
      return;
    }
    const total = Math.max(1, opening.offsetHeight - window.innerHeight);
    const openingRect = opening.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -openingRect.top / total));
    const introEnd = Math.min(.5, window.innerHeight * .7 / total);
    // Hold the last photograph long enough for the closing line to be read.
    const sequenceEnd = .86;
    const sequenceProgress = Math.min(1, Math.max(0, (progress - introEnd) / (sequenceEnd - introEnd)));
    const sceneIndex = playbackComplete
      ? frames.length - 1
      : motionReduced.matches
        ? 0
        : autoplayActive
          ? autoplayIndex
          : Math.min(frames.length - 1, Math.floor(sequenceProgress * frames.length));
    const openingVisible = openingRect.bottom > 0 && openingRect.top < window.innerHeight;
    const showSideNav = contents.getBoundingClientRect().top <= 0;
    let active = "opening";
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= window.innerHeight * .45) active = section.id;
    }
    const pageRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const navProgressHeight = `${Math.min(100, window.scrollY / pageRange * 100)}%`;
    if (openingVisible || autoplayActive) {
      if (!autoplayActive && !playbackComplete) {
        loadOpeningFrame(sceneIndex, true);
        if (!motionReduced.matches) {
          loadOpeningFrame(sceneIndex + 1);
          loadOpeningFrame(sceneIndex + 2);
        }
      }
      if (sceneIndex !== paintedScene) {
        const previous = frames[paintedScene];
        if (previous) {
          previous.style.opacity = "0";
          previous.style.visibility = "hidden";
        }
        frames[sceneIndex].style.opacity = "1";
        frames[sceneIndex].style.visibility = "visible";
        paintedScene = sceneIndex;
        openingCount.textContent = `${String(sceneIndex + 1).padStart(2, "0")} / ${String(frames.length).padStart(2, "0")}`;
      }
      openingCopy.style.opacity = motionReduced.matches ? "1" : autoplayActive || playbackComplete
        ? (sceneIndex === 0 ? "1" : "0")
        : Math.max(0, 1 - progress / (introEnd * .8));
      const showFinal = !motionReduced.matches && sceneIndex === frames.length - 1 && openingVisible;
      openingFinal.classList.toggle("is-visible", showFinal);
      openingFinal.setAttribute("aria-hidden", String(!showFinal));
      const frameProgress = autoplayActive || playbackComplete ? (sceneIndex + 1) / frames.length : sequenceProgress;
      openingProgress.style.height = `${frameProgress * 100}%`;
    }

    if (playbackComplete && showSideNav) hasLeftOpening = true;
    sideNav.classList.toggle("is-hidden", !showSideNav);
    sideNav.toggleAttribute("inert", !showSideNav);
    if (showSideNav) sideNav.removeAttribute("aria-hidden");
    else sideNav.setAttribute("aria-hidden", "true");

    links.forEach((link) => {
      if (link.dataset.nav === active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    navProgress.style.height = navProgressHeight;
  }

  function scheduleUpdate() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(updateScroll);
  }
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  motionReduced.addEventListener("change", scheduleUpdate);
  updateScroll();

  function waitForFrame(index) {
    const frame = frames[index];
    if (!frame || frame.dataset.status !== "loading") return Promise.resolve();
    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        if (frame.dataset.status !== "loading") return;
        frame.dataset.status = "failed";
        const placeholder = frame.querySelector(".opening__placeholder");
        if (placeholder) placeholder.textContent = `SCENE ${String(index + 1).padStart(2, "0")} · 사진을 불러올 수 없습니다`;
        frame.dispatchEvent(new Event("frame-settled"));
      }, 20000);
      frame.addEventListener("frame-settled", () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
      loadOpeningFrame(index, index === 0);
    });
  }

  function finishOpening() {
    if (!autoplayActive) return;
    playbackRun += 1;
    autoplayActive = false;
    playbackComplete = true;
    playbackPaused = false;
    hasLeftOpening = false;
    document.body.classList.remove("opening-locked");
    pauseButton.hidden = true;
    skipButton.hidden = true;
    openingStatus.textContent = "";
    updateScroll();
    window.requestAnimationFrame(() => contents.scrollIntoView({ behavior: "smooth" }));
  }

  function replayOpening() {
    playbackRun += 1;
    autoplayActive = !motionReduced.matches;
    playbackComplete = false;
    playbackPaused = false;
    hasLeftOpening = false;
    autoplayIndex = 0;
    opening.classList.add("opening--short");
    opening.style.removeProperty("--sequence-height");
    pauseButton.hidden = true;
    skipButton.hidden = true;
    pauseButton.textContent = "일시정지";
    openingStatus.textContent = autoplayActive ? "사진 준비 중" : "아래로 스크롤 ↓";
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previousScrollBehavior;
    if (location.hash !== "#opening") {
      try { history.replaceState(null, "", "#opening"); }
      catch { /* Replay still works when local file history is unavailable. */ }
    }
    document.body.classList.toggle("opening-locked", autoplayActive);
    loadOpeningFrame(0, true);
    updateScroll();
    if (autoplayActive) playOpening(playbackRun);
  }

  document.querySelectorAll('a[href="#opening"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      replayOpening();
    });
  });

  document.querySelector(".skip-link").addEventListener("click", () => {
    if (autoplayActive) finishOpening();
  });

  motionReduced.addEventListener("change", () => {
    if (!motionReduced.matches || !autoplayActive) return;
    playbackRun += 1;
    autoplayActive = false;
    playbackComplete = true;
    document.body.classList.remove("opening-locked");
    pauseButton.hidden = true;
    skipButton.hidden = true;
    openingStatus.textContent = "아래로 스크롤 ↓";
    loadOpeningFrame(frames.length - 1, true);
    updateScroll();
  });

  pauseButton.addEventListener("click", () => {
    playbackPaused = !playbackPaused;
    pauseButton.textContent = playbackPaused ? "이어보기" : "일시정지";
    openingStatus.textContent = playbackPaused ? "일시정지" : "자동 재생 중";
  });
  skipButton.addEventListener("click", finishOpening);

  async function waitPlayback(milliseconds, run) {
    let remaining = milliseconds;
    while (remaining > 0 && autoplayActive && run === playbackRun) {
      const started = performance.now();
      await new Promise((resolve) => window.setTimeout(resolve, Math.min(remaining, 80)));
      if (!playbackPaused && !document.hidden) remaining -= performance.now() - started;
    }
  }

  async function waitUntilActive(run) {
    while ((playbackPaused || document.hidden) && autoplayActive && run === playbackRun) {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
  }

  async function playOpening(run) {
    if (!autoplayActive || run !== playbackRun) return;
    for (let index = 0; index < frames.length && autoplayActive && run === playbackRun; index += 1) {
      if (frames[index].dataset.status === "loading") {
        openingStatus.textContent = `장면 준비 중 ${String(index + 1).padStart(2, "0")}/${frames.length}`;
      }
      await waitForFrame(index);
      if (!autoplayActive || run !== playbackRun) return;
      loadOpeningFrame(index + 1);
      loadOpeningFrame(index + 2);
      await waitUntilActive(run);
      if (!autoplayActive || run !== playbackRun) return;
      autoplayIndex = index;
      openingStatus.textContent = "자동 재생 중";
      if (index === 0) {
        pauseButton.hidden = false;
        skipButton.hidden = false;
      }
      updateScroll();
      await waitPlayback(index === 0 ? 1100 : index === frames.length - 1 ? 1500 : 240, run);
    }
    if (run === playbackRun) finishOpening();
  }

  if (autoplayActive) playOpening(++playbackRun);
})();
