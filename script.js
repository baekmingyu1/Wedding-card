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
      });
      img.addEventListener("error", () => {
        if (kind !== "opening") return;
        if (sourceIndex + 1 < openingAlternatives.length) {
          img.src = openingAlternatives[++sourceIndex];
          return;
        }
        placeholder.textContent = `SCENE ${String(index + 1).padStart(2, "0")} · 사진을 불러올 수 없습니다`;
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
  // Reserve the first 70vh of scrolling for the invitation text and first photo.
  opening.style.setProperty("--sequence-height", `${Math.max(300, 170 + openingPhotos.length * 22)}svh`);
  const frames = [...frameHost.children];
  const openingCopy = document.querySelector(".opening__copy");
  const openingFinal = document.getElementById("opening-final");
  const sections = ["opening", "contents", "story", "invitation", "gallery", "location", "account"]
    .map((id) => document.getElementById(id));
  const contents = document.getElementById("contents");
  const sideNav = document.querySelector(".side-nav");
  const links = [...document.querySelectorAll("[data-nav]")];
  let pending = false;

  function loadOpeningFrame(index, highPriority = false) {
    const image = frames[index]?.querySelector("img[data-src]");
    if (!image) return;
    if (highPriority) image.fetchPriority = "high";
    image.src = image.dataset.src;
    delete image.dataset.src;
  }

  function updateScroll() {
    pending = false;
    const total = Math.max(1, opening.offsetHeight - window.innerHeight);
    const openingRect = opening.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -openingRect.top / total));
    const introEnd = Math.min(.5, window.innerHeight * .7 / total);
    // Hold the last photograph long enough for the closing line to be read.
    const sequenceEnd = .86;
    const sequenceProgress = Math.min(1, Math.max(0, (progress - introEnd) / (sequenceEnd - introEnd)));
    const sceneIndex = motionReduced.matches
      ? frames.length - 1
      : Math.min(frames.length - 1, Math.floor(sequenceProgress * frames.length));
    if (openingRect.bottom > 0 && openingRect.top < window.innerHeight) {
      loadOpeningFrame(sceneIndex, true);
      if (sceneIndex === 0) loadOpeningFrame(frames.length - 1);
      if (!motionReduced.matches) {
        loadOpeningFrame(sceneIndex + 1);
        loadOpeningFrame(sceneIndex + 2);
      }
    }
    frames.forEach((frame, index) => {
      const visible = index === sceneIndex;
      frame.style.opacity = visible ? "1" : "0";
      frame.style.visibility = visible ? "visible" : "hidden";
    });
    document.getElementById("opening-count").textContent = `${String(sceneIndex + 1).padStart(2, "0")} / ${String(frames.length).padStart(2, "0")}`;
    openingCopy.style.opacity = motionReduced.matches ? "1" : Math.max(0, 1 - progress / (introEnd * .8));
    const showFinal = !motionReduced.matches && sceneIndex === frames.length - 1 && openingRect.bottom > 0;
    openingFinal.classList.toggle("is-visible", showFinal);
    openingFinal.setAttribute("aria-hidden", String(!showFinal));
    document.getElementById("opening-progress").style.height = `${sequenceProgress * 100}%`;

    const showSideNav = contents.getBoundingClientRect().top <= 0;
    sideNav.classList.toggle("is-hidden", !showSideNav);
    sideNav.toggleAttribute("inert", !showSideNav);
    if (showSideNav) sideNav.removeAttribute("aria-hidden");
    else sideNav.setAttribute("aria-hidden", "true");

    let active = "opening";
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= window.innerHeight * .45) active = section.id;
    }
    links.forEach((link) => {
      if (link.dataset.nav === active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    const pageRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    document.getElementById("nav-progress").style.height = `${Math.min(100, window.scrollY / pageRange * 100)}%`;
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
})();
