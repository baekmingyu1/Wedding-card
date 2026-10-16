(() => {
  "use strict";

  const content = window.WEDDING_CONTENT;
  if (!content) return;

  const parkingDialog = document.getElementById("parking-map-dialog");
  const parkingImage = document.getElementById("parking-map-image");
  const parkingError = document.getElementById("parking-map-error");
  document.getElementById("parking-map-open").addEventListener("click", () => {
    if (!parkingImage.getAttribute("src") || !parkingError.hidden) {
      parkingError.hidden = true;
      parkingImage.src = parkingImage.dataset.src;
    }
    parkingDialog.showModal();
    document.documentElement.classList.add("parking-map-open");
  });
  parkingImage.addEventListener("error", () => { parkingError.hidden = false; });
  parkingImage.addEventListener("load", () => { parkingError.hidden = true; });
  document.getElementById("parking-map-close").addEventListener("click", () => parkingDialog.close());
  parkingDialog.addEventListener("close", () => document.documentElement.classList.remove("parking-map-open"));
  let parkingBackdropDown = false;
  const outsideParking = (event) => {
    const rect = parkingDialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  parkingDialog.addEventListener("pointerdown", (event) => { parkingBackdropDown = event.target === parkingDialog && outsideParking(event); });
  parkingDialog.addEventListener("click", (event) => {
    if (parkingBackdropDown && event.target === parkingDialog && outsideParking(event)) parkingDialog.close();
    parkingBackdropDown = false;
  });

  const welcomeDialog = document.getElementById("welcome-dialog");
  const visitKey = "wedding-guest-visit";
  let rememberedGuest = "";
  try { rememberedGuest = sessionStorage.getItem(visitKey) || ""; } catch { /* Storage is optional. */ }
  const atEntry = !location.hash || location.hash === "#opening";
  const resumeInvitation = Boolean(rememberedGuest) && atEntry;
  const welcomeWanted = !rememberedGuest && window.scrollY < 10 && atEntry;
  function rememberGuest(value) {
    rememberedGuest = value;
    try {
      if (value) sessionStorage.setItem(visitKey, value);
      else sessionStorage.removeItem(visitKey);
    } catch { /* Navigation also works when browser storage is unavailable. */ }
  }
  const motionReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const frameHost = document.getElementById("opening-frames");
  const galleryHost = document.getElementById("gallery-grid");
  const accountHost = document.getElementById("account-list");
  const toast = document.getElementById("toast");
  let toastTimer;

  document.querySelectorAll("[data-field]").forEach((element) => {
    const value = content[element.dataset.field];
    if (element.dataset.field === "parkingMessage" && Array.isArray(value)) {
      value.forEach((text, index) => {
        if (index) element.append(document.createTextNode(" "));
        const phrase = document.createElement("span");
        phrase.className = "parking-phrase";
        phrase.textContent = text;
        element.append(phrase);
      });
    } else element.textContent = value || "";
  });

  for (const line of content.invitation || []) {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    document.getElementById("invitation-message").append(paragraph);
  }

  const photoUrl = (photo) => typeof photo === "string" ? photo : photo?.src;

  function addPhoto(host, photo, index, kind, sizes = "100vw") {
    const wrapper = document.createElement(kind === "opening" ? "div" : "figure");
    wrapper.className = kind === "opening"
      ? "opening__frame opening__frame--fallback"
      : "gallery__item";
    const path = photoUrl(photo);
    if (kind === "opening") wrapper.dataset.status = path ? "pending" : "failed";

    const placeholder = document.createElement("span");
    placeholder.className = kind === "opening" ? "opening__placeholder" : "gallery__placeholder";
    placeholder.textContent = kind === "opening"
      ? `SCENE ${String(index + 1).padStart(2, "0")} · ${path ? "불러오는 중" : "사진 준비 중"}`
      : `PHOTO ${String(index + 1).padStart(2, "0")}`;
    wrapper.append(placeholder);

    if (path) {
      const picture = document.createElement("picture");
      const img = document.createElement("img");
      if (photo.mobileSrcset) {
        const source = document.createElement("source");
        source.media = "(max-width: 760px)";
        source.sizes = kind === "opening" ? "135vw" : sizes;
        if (kind === "opening") source.dataset.srcset = photo.mobileSrcset;
        else source.srcset = photo.mobileSrcset;
        picture.append(source);
      }
      if (kind === "opening") img.hidden = true;
      else img.classList.add("is-loading");
      img.decoding = "async";
      img.alt = kind === "opening" ? "" : `두 사람의 사진 ${index + 1}`;
      if (kind === "gallery") img.loading = "lazy";
      if (kind === "opening") img.fetchPriority = index === 0 ? "high" : "low";
      if (photo.srcset) {
        img.sizes = kind === "opening" ? "100vw" : sizes;
        if (kind === "opening") img.dataset.srcset = photo.srcset;
        else img.srcset = photo.srcset;
      }
      if (photo.width && photo.height) {
        img.width = photo.width;
        img.height = photo.height;
      }
      if (kind === "opening" && photo.blur) {
        wrapper.style.setProperty("--frame-image", `url(${JSON.stringify(photo.blur)})`);
      }
      img.addEventListener("load", async () => {
        if (kind === "opening" && img.decode) {
          try { await img.decode(); } catch {
            if (wrapper.dataset.status !== "failed") {
              placeholder.textContent = `SCENE ${String(index + 1).padStart(2, "0")} · 사진을 불러올 수 없습니다`;
              wrapper.dataset.status = "failed";
              wrapper.dispatchEvent(new Event("frame-settled"));
              scheduleUpdate();
            }
            return;
          }
        }
        if (kind === "opening" && wrapper.dataset.status === "failed") return;
        img.hidden = false;
        img.classList.remove("is-loading");
        placeholder.remove();
        wrapper.classList.remove("opening__frame--fallback");
        if (kind === "opening") {
          wrapper.dataset.status = "ready";
          wrapper.dispatchEvent(new Event("frame-settled"));
          scheduleUpdate();
        }
      });
      img.addEventListener("error", () => {
        if (kind !== "opening") { wrapper.classList.add("gallery__item--failed"); return; }
        placeholder.textContent = `SCENE ${String(index + 1).padStart(2, "0")} · 사진을 불러올 수 없습니다`;
        wrapper.dataset.status = "failed";
        wrapper.dispatchEvent(new Event("frame-settled"));
        scheduleUpdate();
      });
      if (kind === "opening") img.dataset.src = path;
      else img.src = path;
      picture.append(img);
      wrapper.append(picture);
    }
    if (kind === "gallery" && path) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery__open";
      button.setAttribute("aria-label", "사진 " + (index + 1) + " 확대 보기");
      button.setAttribute("aria-haspopup", "dialog");
      button.addEventListener("click", () => openGalleryPhoto(index, false, button));
      while (wrapper.firstChild) button.append(wrapper.firstChild);
      wrapper.append(button);
    }
    host.append(wrapper);
  }

  const openingPhotos = (content.openingPhotos || []).filter(Boolean);
  if (!openingPhotos.length) openingPhotos.push("");
  openingPhotos.forEach((path, index) => addPhoto(frameHost, path, index, "opening"));

  const galleryPhotos = content.galleryPhotos?.length ? content.galleryPhotos : Array(6).fill("");
  const galleryPager = document.getElementById("gallery-pagination");
  const galleryPageSize = 9;
  const gallerySizes = "(max-width: 760px) calc((100vw - 100px) / 3), (max-width: 964px) calc((100vw - 84px) / 3), 294px";
  const galleryPageCount = Math.ceil(galleryPhotos.length / galleryPageSize);

  const galleryDialog = document.getElementById("gallery-dialog");
  const photoStage = document.getElementById("gallery-photo-stage");
  const photoStatus = document.getElementById("gallery-photo-status");
  const photoCounter = document.getElementById("gallery-photo-counter");
  const photoPrevious = document.getElementById("gallery-photo-previous");
  const photoNext = document.getElementById("gallery-photo-next");
  const photoThumbnails = document.getElementById("gallery-photo-thumbnails");
  let swipeStart = null;
  let activePhoto = 0;
  let previousBodyOverflow = "";
  let photoDialogActive = false;
  let photoHistoryPending = false;
  let photoRestorePending = false;
  let photoReturnPosition = { top: 0, left: 0 };
  let photoReturnFocus = null;
  let previousPhotoScrollRestoration = "auto";
  let photoRestoreFrame = 0;
  const photoHistoryKey = "weddingGalleryPhoto";
  const historyPhotoIndex = () => {
    const index = history.state?.[photoHistoryKey];
    return Number.isInteger(index) && index >= 0 && index < galleryPhotos.length ? index : null;
  };
  const resolveGalleryPhoto = (index) => galleryPhotos[index] || openingPhotos[
    Math.round(index * (openingPhotos.length - 1) / Math.max(1, galleryPhotos.length - 1))
  ];

  // Warm the HTTP cache after the intro is ready, without retaining every decoded image.
  let galleryPreloadStarted = false;
  function preloadGallery() {
    if (galleryPreloadStarted || navigator.connection?.saveData) return;
    galleryPreloadStarted = true;
    const photos = galleryPhotos.map((_, index) => resolveGalleryPhoto(index)).filter(photoUrl);
    const waitForVisible = () => new Promise((resolve) => {
      if (!document.hidden) { resolve(); return; }
      const resume = () => {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", resume);
        resolve();
      };
      document.addEventListener("visibilitychange", resume);
    });
    const load = (photo, thumbnail) => new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.fetchPriority = "low";
      img.onload = img.onerror = () => {
        img.onload = img.onerror = null;
        resolve();
      };
      if (thumbnail) {
        img.sizes = gallerySizes;
        const srcset = window.matchMedia("(max-width: 760px)").matches
          ? photo.mobileSrcset || photo.srcset : photo.srcset;
        if (srcset) img.srcset = srcset;
      }
      img.src = photoUrl(photo);
    });
    const run = async () => {
      // Finish all grid sizes before spending bandwidth on enlarged photos.
      for (const thumbnail of [true, false]) {
        let nextIndex = 0;
        const worker = async () => {
          while (nextIndex < photos.length) {
            await waitForVisible();
            if (navigator.connection?.saveData) return;
            const photo = photos[nextIndex++];
            if (photo) await load(photo, thumbnail);
          }
        };
        await Promise.all([worker(), worker()]);
      }
    };
    void run();
  }

  // Keep only nearby decoded photos in memory; browser HTTP caching handles older ones.
  const photoCache = new Map();
  let photoRequest = 0;
  let photoLoadingTimer;
  function prepareGalleryPhoto(index, priority = "low") {
    if (photoCache.has(index)) {
      const cached = photoCache.get(index);
      if (priority === "high") cached.img.fetchPriority = "high";
      return cached;
    }
    const img = new Image();
    img.alt = "두 사람의 사진 " + (index + 1);
    img.decoding = "async";
    img.draggable = false;
    img.fetchPriority = priority;
    const entry = { img, ready: false, promise: null };
    entry.promise = new Promise((resolve, reject) => {
      img.onload = async () => {
        try { await img.decode(); } catch { /* Some webviews cannot decode explicitly. */ }
        if (!img.naturalWidth) { reject(new Error("Invalid photo")); return; }
        entry.ready = true;
        resolve(img);
      };
      img.onerror = () => reject(new Error("Photo unavailable"));
    });
    photoCache.set(index, entry);
    entry.promise.catch(() => { if (photoCache.get(index) === entry) photoCache.delete(index); });
    img.src = photoUrl(resolveGalleryPhoto(index)) || "";
    return entry;
  }
  function warmGalleryPhotos(index) {
    for (const key of photoCache.keys()) {
      if (Math.abs(key - index) > 2) photoCache.delete(key);
    }
    if (navigator.connection?.saveData) return;
    for (const offset of [1, -1, 2, -2]) {
      const neighbor = index + offset;
      if (neighbor >= 0 && neighbor < galleryPhotos.length) prepareGalleryPhoto(neighbor);
    }
  }

  async function showGalleryPhoto(index) {
    if (index < 0 || index >= galleryPhotos.length) return;
    activePhoto = index;
    if (galleryDialog.open && historyPhotoIndex() !== null) {
      history.replaceState({ ...history.state, [photoHistoryKey]: index }, "");
    }
    Array.from(photoThumbnails.children).forEach((button, position) => {
      button.setAttribute("aria-current", position === index ? "true" : "false");
    });
    const selected = photoThumbnails.children[index];
    if (selected) photoThumbnails.scrollTo({
      left: selected.offsetLeft - photoThumbnails.offsetLeft - (photoThumbnails.clientWidth - selected.clientWidth) / 2,
      behavior: motionReduced.matches ? "instant" : "smooth"
    });
    photoCounter.textContent = (index + 1) + " / " + galleryPhotos.length;
    photoPrevious.disabled = index === 0;
    photoNext.disabled = index === galleryPhotos.length - 1;
    const request = ++photoRequest;
    window.clearTimeout(photoLoadingTimer);
    photoStatus.textContent = "";
    const entry = prepareGalleryPhoto(index, "high");
    // Keep the previous photo visible until the next full-size image is decoded.
    if (!photoStage.firstChild) {
      const thumbnail = photoThumbnails.children[index]?.querySelector("img");
      if (thumbnail?.complete && thumbnail.naturalWidth) {
        const preview = new Image();
        preview.src = thumbnail.currentSrc;
        preview.alt = entry.img.alt;
        photoStage.replaceChildren(preview);
      }
    }
    if (!entry.ready) photoLoadingTimer = window.setTimeout(() => {
      if (request === photoRequest) photoStatus.textContent = "다음 사진을 준비하고 있습니다.";
    }, 700);
    try {
      const img = entry.ready ? entry.img : await entry.promise;
      if (request !== photoRequest || !galleryDialog.open) return;
      window.clearTimeout(photoLoadingTimer);
      photoStatus.textContent = "";
      photoStage.replaceChildren(img);
      warmGalleryPhotos(index);
    } catch {
      if (request !== photoRequest || !galleryDialog.open) return;
      window.clearTimeout(photoLoadingTimer);
      photoStatus.textContent = "사진을 불러오지 못했습니다. 썸네일을 눌러 다시 시도해 주세요.";
    }
  }

  function openGalleryPhoto(index, fromHistory = false, opener = null) {
    // Closing traverses history asynchronously; do not create another entry meanwhile.
    if (photoHistoryPending || photoRestorePending) return;
    if (!galleryDialog.open) {
      photoReturnPosition = { top: window.scrollY, left: window.scrollX };
      photoReturnFocus = opener || (galleryHost.contains(document.activeElement) ? document.activeElement : galleryHost.querySelector("button"));
      previousPhotoScrollRestoration = history.scrollRestoration;
      history.scrollRestoration = "manual";
      // Set native dialog's return target, including touch browsers that do not focus buttons.
      photoReturnFocus?.focus({ preventScroll: true });
      if (!fromHistory) history.pushState({ ...history.state, [photoHistoryKey]: index }, "");
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      photoDialogActive = true;
      galleryDialog.showModal();
    }
    if (!photoThumbnails.childElementCount) {
      galleryPhotos.forEach((photo, position) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "gallery-dialog__thumbnail";
        button.setAttribute("aria-label", "사진 " + (position + 1) + " 보기");
        const img = new Image();
        const source = resolveGalleryPhoto(position);
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.draggable = false;
        if (source.srcset) { img.sizes = "64px"; img.srcset = source.srcset; }
        img.src = photoUrl(source) || "";
        button.append(img);
        button.addEventListener("click", () => showGalleryPhoto(position));
        photoThumbnails.append(button);
      });
    }
    showGalleryPhoto(index);
  }
  function restoreGalleryPosition() {
    photoRestorePending = true;
    cancelAnimationFrame(photoRestoreFrame);
    const restore = () => {
      if (photoReturnFocus?.isConnected) photoReturnFocus.focus({ preventScroll: true });
      window.scrollTo({ ...photoReturnPosition, behavior: "instant" });
    };
    restore();
    // Run after history traversal/native focus restoration, before enabling intro replay.
    photoRestoreFrame = requestAnimationFrame(() => {
      restore();
      photoRestoreFrame = requestAnimationFrame(() => {
        restore();
        if (photoHistoryPending) return; // popstate completes the restoration.
        history.scrollRestoration = previousPhotoScrollRestoration;
        photoRestorePending = false;
      });
    });
  }
  function closeGalleryPhoto() {
    if (!photoDialogActive) return;
    photoRestorePending = true;
    photoDialogActive = false;
    galleryDialog.close();
    document.body.style.overflow = previousBodyOverflow;
    ++photoRequest;
    window.clearTimeout(photoLoadingTimer);
    photoStatus.textContent = "";
    photoStage.replaceChildren();
    swipeStart = null;
    lastPhotoTap = null;
    restoreGalleryPosition();
  }
  function requestGalleryClose() {
    if (!photoDialogActive || photoHistoryPending) return;
    if (historyPhotoIndex() !== null) {
      photoHistoryPending = true;
      history.back();
    }
    closeGalleryPhoto();
  }
  document.getElementById("gallery-photo-close").addEventListener("click", requestGalleryClose);
  galleryDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestGalleryClose();
  });
  galleryDialog.addEventListener("close", () => {
    // Ignore a queued close event if the dialog has already been reopened.
    if (!galleryDialog.open) requestGalleryClose();
  });
  galleryDialog.addEventListener("click", (event) => {
    if (event.target === galleryDialog) requestGalleryClose();
  });
  window.addEventListener("popstate", () => {
    photoHistoryPending = false;
    const index = historyPhotoIndex();
    if (index === null) {
      if (photoDialogActive) closeGalleryPhoto();
      else if (photoRestorePending) restoreGalleryPosition();
    } else openGalleryPhoto(index, true);
  });

  // Older mobile webviews may ignore touch-action. Cancel zoom gestures only
  // while this dialog is open; never restrict the page's viewport or zoom keys.
  const preventPhotoPinch = (event) => {
    if (!galleryDialog.open) return;
    if (event.touches.length > 1) {
      swipeStart = null;
      lastPhotoTap = null;
      event.preventDefault();
    }
  };
  document.addEventListener("touchstart", preventPhotoPinch, { passive: false, capture: true });
  document.addEventListener("touchmove", preventPhotoPinch, { passive: false, capture: true });
  for (const type of ["gesturestart", "gesturechange"]) {
    document.addEventListener(type, (event) => {
      if (galleryDialog.open) event.preventDefault();
    }, { passive: false, capture: true });
  }
  galleryDialog.addEventListener("wheel", (event) => {
    if (event.ctrlKey) event.preventDefault();
  }, { passive: false });
  let lastPhotoTap = null;
  galleryDialog.addEventListener("touchend", (event) => {
    if (event.touches.length || event.changedTouches.length !== 1) {
      lastPhotoTap = null;
      return;
    }
    const touch = event.changedTouches[0];
    const now = performance.now();
    const isDoubleTap = lastPhotoTap && now - lastPhotoTap.time < 350 &&
      Math.hypot(touch.clientX - lastPhotoTap.x, touch.clientY - lastPhotoTap.y) < 30;
    lastPhotoTap = { time: now, x: touch.clientX, y: touch.clientY };
    if (isDoubleTap) {
      event.preventDefault();
      // Cancel native double-tap zoom without losing a second control activation.
      event.target.closest("button")?.click();
    }
  }, { passive: false });
  galleryDialog.addEventListener("dblclick", (event) => event.preventDefault());
  photoPrevious.addEventListener("click", () => showGalleryPhoto(activePhoto - 1));
  photoNext.addEventListener("click", () => showGalleryPhoto(activePhoto + 1));
  galleryDialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" && activePhoto > 0) {
      event.preventDefault();
      showGalleryPhoto(activePhoto - 1);
    } else if (event.key === "ArrowRight" && activePhoto < galleryPhotos.length - 1) {
      event.preventDefault();
      showGalleryPhoto(activePhoto + 1);
    }
  });

  photoStage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) { swipeStart = null; return; }
    if (window.visualViewport && window.visualViewport.scale > 1) return;
    swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    photoStage.setPointerCapture(event.pointerId);
  });
  photoStage.addEventListener("pointerup", (event) => {
    if (!swipeStart || swipeStart.id !== event.pointerId) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      showGalleryPhoto(activePhoto + (dx < 0 ? 1 : -1));
    }
  });
  photoStage.addEventListener("pointercancel", () => { swipeStart = null; });

  let galleryPage = 0;
  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "이전";
  previous.addEventListener("click", () => renderGalleryPage(galleryPage - 1, true));
  const status = document.createElement("span");
  status.className = "gallery__page-status";
  status.setAttribute("aria-live", "polite");
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "다음";
  next.addEventListener("click", () => renderGalleryPage(galleryPage + 1, true));
  galleryPager.append(previous, status, next);
  galleryPager.hidden = galleryPageCount <= 1;

  function renderGalleryPage(page, scrollToGallery = false) {
    galleryPage = page;
    galleryHost.replaceChildren();
    const start = page * galleryPageSize;
    const photos = galleryPhotos.slice(start, start + galleryPageSize);
    photos.forEach((photo, offset) => {
      const index = start + offset;
      addPhoto(galleryHost, resolveGalleryPhoto(index), index, "gallery", gallerySizes);
    });
    previous.disabled = page === 0;
    next.disabled = page === galleryPageCount - 1;
    status.textContent = (page + 1) + " / " + galleryPageCount;
    if (scrollToGallery) {
      if (document.activeElement === next && next.disabled) previous.focus({ preventScroll: true });
      if (document.activeElement === previous && previous.disabled) next.focus({ preventScroll: true });
      document.getElementById("gallery").scrollIntoView({ behavior: motionReduced.matches ? "auto" : "smooth", block: "start" });
    }
  }
  renderGalleryPage(0);
  if (historyPhotoIndex() !== null) openGalleryPhoto(historyPhotoIndex(), true);
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

  function setExternalLink(id, value) {
    if (!value) return false;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return false;
      const link = document.getElementById(id);
      link.href = url.href;
      link.hidden = false;
      return true;
    } catch { return false; }
  }

  for (const [hostId, entries, titleKey, detailKey] of [
    ["parking-locations", content.parkingLocations || [], "label", "address"],
    ["subway-routes", content.subwayRoutes || [], "station", "directions"]
  ]) {
    const host = document.getElementById(hostId);
    for (const entry of entries) {
      const item = document.createElement("div");
      item.className = "directions__place";
      const title = document.createElement("p");
      title.className = "directions__place-name";
      title.textContent = entry[titleKey];
      const detail = document.createElement("p");
      detail.className = "directions__detail";
      detail.textContent = entry[detailKey];
      item.append(title, detail);
      host.append(item);
    }
  }

  const busStopsHost = document.getElementById("bus-stops");
  for (const stop of content.busStops || []) {
    const block = document.createElement("div");
    block.className = "directions__bus-stop";
    const heading = document.createElement("p");
    heading.className = "directions__stop-heading";
    const name = document.createElement("span");
    name.className = "directions__stop-name";
    for (const [index, part] of stop.name.split("·").entries()) {
      if (index) name.append(document.createTextNode(" · "));
      const unit = document.createElement("span");
      unit.className = "text-unit";
      unit.textContent = part.trim();
      name.append(unit);
    }
    heading.append(name);
    try {
      const url = new URL(stop.mapUrl);
      if (url.protocol === "https:" && ["map.naver.com", "naver.me"].includes(url.hostname)) {
        const link = document.createElement("a");
        link.className = "directions__stop-map";
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", `${stop.name} 정류장 네이버 지도 보기 (새 창)`);
        link.title = "네이버 지도에서 정류장 찾기";
        const icon = document.createElement("span");
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "↗";
        link.append(icon);
        heading.append(link);
      }
    } catch { /* Keep the stop name readable if a map link is unavailable. */ }
    const routes = document.createElement("p");
    routes.className = "directions__detail";
    routes.textContent = stop.routes;
    block.append(heading, routes);
    busStopsHost.append(block);
  }

  const hasMaps = [
    setExternalLink("naver-map-link", content.naverMapUrl),
    setExternalLink("kakao-map-link", content.kakaoMapUrl),
    setExternalLink("google-map-link", content.googleMapUrl),
    setExternalLink("tmap-link", content.tmapUrl)
  ].some(Boolean);
  document.getElementById("map-pending").hidden = hasMaps;
  function initVenueMap() {
    const root = document.getElementById("venue-map");
    const canvas = document.getElementById("venue-map-canvas");
    const fallback = document.getElementById("venue-map-fallback");
    const fallbackImage = document.getElementById("venue-map-image");
    const status = document.getElementById("venue-map-status");
    const activate = document.getElementById("venue-map-activate");
    const controls = document.getElementById("venue-map-tools");
    const key = content.naverMapKeyId?.trim();
    const coordinates = content.naverMapCenter?.split(",").map(Number);
    if (!key || !coordinates || coordinates.length !== 2 || !coordinates.every(Number.isFinite)) return;
    const [longitude, latitude] = coordinates;
    if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return;
    root.hidden = false;
    canvas.setAttribute("aria-label", `${content.venue} 위치 지도`);
    fallbackImage.alt = `${content.venue} 위치 안내 지도`;
    fallback.href = document.getElementById("naver-map-link").href;
    let map, marker, timer, started = false, failed = false, ready = false;
    const setInteractive = (active) => {
      if (!ready || failed) return;
      map.setOptions({ draggable: active, pinchZoom: active, keyboardShortcuts: active,
        disableDoubleClickZoom: !active, disableDoubleTapZoom: !active,
        disableTwoFingerTapZoom: !active, scrollWheel: false, zoomControl: active });
      canvas.inert = !active;
      canvas.style.touchAction = active ? "none" : "pan-y";
      activate.hidden = active;
      controls.hidden = !active;
    };
    const showFallback = (reason = "load-timeout") => {
      if (failed) return;
      failed = true;
      clearTimeout(timer);
      marker?.setMap(null);
      map?.destroy();
      canvas.hidden = true;
      activate.hidden = controls.hidden = true;
      root.dataset.state = "fallback";
      root.dataset.failure = typeof reason === "string" ? reason : "network-error";
      console.warn("Venue map fallback:", root.dataset.failure);
      document.getElementById("venue-map-notice").hidden = false;
      status.hidden = false;
      status.textContent = "아래 지도 버튼에서 위치를 확인해 주세요.";
      if (!/^https?:$/.test(location.protocol)) return;
      const params = new URLSearchParams({
        w: "900", h: "580", center: `${longitude},${latitude}`, level: "16", lang: "ko",
        markers: `type:d|size:mid|color:Orange|pos:${longitude} ${latitude}`,
        "X-NCP-APIGW-API-KEY-ID": key
      });
      fallbackImage.onload = () => { fallback.hidden = false; status.hidden = true; };
      fallbackImage.onerror = () => { fallback.hidden = true; };
      fallbackImage.loading = "eager";
      fallbackImage.src = `https://maps.apigw.ntruss.com/map-static/v2/raster-cors?${params}`;
    };
    const createMap = () => {
      if (failed || map) return;
      if (!window.naver?.maps?.Map) { showFallback("sdk-unavailable"); return; }
      try {
        const position = new naver.maps.LatLng(latitude, longitude);
        map = new naver.maps.Map(canvas, {
          center: position, zoom: 16, minZoom: 7, maxZoom: 20,
          draggable: false, pinchZoom: false, scrollWheel: false, keyboardShortcuts: false,
          disableDoubleClickZoom: true, disableDoubleTapZoom: true, disableTwoFingerTapZoom: true,
          zoomControl: false
        });
        const label = document.createElement("span");
        label.className = "venue-map__marker";
        label.textContent = content.venue;
        marker = new naver.maps.Marker({ position, map, title: content.venue,
          icon: { content: label.outerHTML, anchor: new naver.maps.Point(0, 0) } });
        const markReady = () => {
          if (failed || ready) return;
          clearTimeout(timer);
          ready = true;
          root.dataset.state = "ready";
          status.hidden = true;
          setInteractive(false);
        };
        // A dynamically injected SDK can finish init before listeners attach.
        // Map construction enables controls; tiles may continue loading normally.
        markReady();
        naver.maps.Event.once(map, "init", markReady);
        naver.maps.Event.once(map, "tilesloaded", markReady);
      } catch (error) {
        console.error("Venue map initialization failed:", error);
        showFallback("initialization-error");
      }
    };
    const load = () => {
      if (started) return;
      started = true;
      root.dataset.state = "loading";
      if (!/^https?:$/.test(location.protocol)) { showFallback(); return; }
      timer = window.setTimeout(() => showFallback("sdk-timeout"), 20000);
      window.navermap_authFailure = () => showFallback("authentication-failed");
      if (window.naver?.maps?.Map) { createMap(); return; }
      window.initWeddingVenueMap = createMap;
      const sdk = document.createElement("script");
      sdk.src = `https://oapi.map.naver.com/openapi/v3/maps.js?${new URLSearchParams({ ncpKeyId: key, callback: "initWeddingVenueMap" })}`;
      sdk.async = true;
      sdk.onload = createMap;
      sdk.onerror = () => showFallback("sdk-network-error");
      document.head.append(sdk);
    };
    activate.addEventListener("click", () => {
      setInteractive(true);
      document.getElementById("venue-map-lock").focus({ preventScroll: true });
    });
    document.getElementById("venue-map-lock").addEventListener("click", () => {
      setInteractive(false);
      activate.focus({ preventScroll: true });
    });
    document.getElementById("venue-map-reset").addEventListener("click", () => {
      if (!ready || failed) return;
      map.setCenter(new naver.maps.LatLng(latitude, longitude));
      map.setZoom(16, false);
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && ready && !failed && !canvas.inert) {
        setInteractive(false);
        activate.focus({ preventScroll: true });
      }
    });
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); load(); }
      }, { rootMargin: "300px" });
      observer.observe(root);
    } else load();
  }
  initVenueMap();
  const rsvpForm = document.getElementById("rsvp-form");
  const rsvpFields = document.getElementById("rsvp-fields");
  const rsvpStatus = document.getElementById("rsvp-status");
  const rsvpSubmit = document.getElementById("rsvp-submit");
  const rsvpPending = document.getElementById("rsvp-pending");
  const endpoint = content.rsvpEndpoint || "";
  const rsvpReady = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint);
  const externalRsvp = !rsvpReady && setExternalLink("rsvp-link", content.rsvpUrl);
  rsvpForm.hidden = Boolean(externalRsvp);
  rsvpFields.disabled = !rsvpReady;
  rsvpPending.hidden = rsvpReady || externalRsvp;
  let rsvpBusy = false;
  let lastPayload = "";
  let submissionId = "";
  function updateAttendance() {
    const attending = rsvpForm.elements.attendance.value === "참석";
    document.getElementById("rsvp-attending").hidden = !attending;
    for (const name of ["guests", "meal"]) {
      rsvpForm.querySelectorAll(`[name="${name}"]`).forEach((input) => {
        input.disabled = !attending;
        input.required = attending;
      });
    }
  }
  rsvpForm.addEventListener("change", (event) => {
    if (event.target.name === "attendance") updateAttendance();
  });
  updateAttendance();
  rsvpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!rsvpReady || rsvpBusy || !rsvpForm.reportValidity()) return;
    const submittedFromWelcome = welcomeDialog.open && welcomeRsvp.contains(rsvpForm);
    const values = Object.fromEntries(new FormData(rsvpForm));
    values.name = values.name.trim();
    values.message = values.message.trim();
    if (!values.name) { rsvpStatus.textContent = "성함을 입력해 주세요."; return; }
    const payload = JSON.stringify(values);
    if (lastPayload !== payload) {
      submissionId = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
      lastPayload = payload;
    }
    values.submissionId = submissionId;
    rsvpBusy = true;
    rsvpFields.disabled = true;
    rsvpForm.setAttribute("aria-busy", "true");
    rsvpSubmit.textContent = "전달 중…";
    rsvpStatus.textContent = "참석 여부를 전달하고 있습니다.";
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      // A simple form POST avoids preflight. Never use no-cors: success must be confirmed.
      const response = await fetch(endpoint, { method: "POST", body: new URLSearchParams(values), credentials: "omit", signal: controller.signal });
      if (!response.ok) throw new Error("HTTP error");
      const result = await response.json();
      if (result.ok !== true || result.submissionId !== submissionId) throw new Error("Unconfirmed write");
      rsvpStatus.textContent = "참석 여부가 전달되었습니다. 알려주셔서 감사합니다.";
      rsvpForm.reset();
      lastPayload = "";
      submissionId = "";
      updateAttendance();
      if (submittedFromWelcome && welcomeDialog.open && welcomeRsvp.contains(rsvpForm)) {
        enterOpening();
        showToast("참석 여부가 전달되었습니다. 알려주셔서 감사합니다.");
      }
    } catch {
      rsvpStatus.textContent = "저장 여부를 확인하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 눌러 주세요.";
    } finally {
      window.clearTimeout(timer);
      rsvpBusy = false;
      rsvpFields.disabled = false;
      rsvpForm.removeAttribute("aria-busy");
      rsvpSubmit.textContent = "참석 여부 전달하기";
    }
  });

  const calendarGrid = document.getElementById("calendar-grid");
  const calendarMonth = document.getElementById("calendar-month");
  const countdownValue = document.getElementById("countdown-value");
  const countdownCaption = document.getElementById("countdown-caption");
  const eventDate = content.eventDate ? new Date(content.eventDate) : null;
  const eventReady = eventDate && !Number.isNaN(eventDate.getTime());
  const koreanParts = (date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric"
    }).formatToParts(date);
    return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  };

  if (eventReady) {
    const { year, month, day } = koreanParts(eventDate);
    calendarMonth.textContent = `${year}. ${String(month).padStart(2, "0")}`;
    const dateScene = document.getElementById("date-scene-date");
    for (const [index, value] of [String(month).padStart(2, "0"), "·", String(day).padStart(2, "0")].entries()) {
      const part = document.createElement("span");
      part.className = index === 1 ? "date-scene__separator" : "date-scene__part";
      part.textContent = value;
      dateScene.append(part);
    }
    document.getElementById("calendar-event-time").dateTime = content.eventDate;
    document.getElementById("calendar-event-date").textContent = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", dateStyle: "full"
    }).format(eventDate);
    document.getElementById("calendar-event-hour").textContent = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", hour: "numeric", minute: "numeric", hour12: true
    }).format(eventDate);
    for (const weekday of ["일", "월", "화", "수", "목", "금", "토"]) {
      const label = document.createElement("span");
      label.className = "calendar__weekday";
      label.textContent = weekday;
      calendarGrid.append(label);
    }
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let index = 0; index < firstWeekday; index += 1) {
      const blank = document.createElement("span");
      blank.setAttribute("aria-hidden", "true");
      calendarGrid.append(blank);
    }
    for (let date = 1; date <= lastDay; date += 1) {
      const cell = document.createElement("span");
      cell.textContent = String(date);
      cell.classList.add("calendar__day");
      if (date === day) {
        cell.classList.add("calendar__day--event");
        const ring = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        ring.setAttribute("viewBox", "0 0 56 56");
        ring.setAttribute("aria-hidden", "true");
        ring.classList.add("calendar__event-ring");
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "28"); circle.setAttribute("cy", "28");
        circle.setAttribute("r", "24"); circle.setAttribute("pathLength", "1");
        ring.append(circle); cell.append(ring);
        cell.setAttribute("aria-label", `${year}년 ${month}월 ${day}일 예식일`);
      }
      calendarGrid.append(cell);
    }
    const eventDay = Date.UTC(year, month - 1, day);
    function updateCountdown() {
      const now = new Date();
      const current = koreanParts(now);
      const today = Date.UTC(current.year, current.month - 1, current.day);
      const days = Math.round((eventDay - today) / 86400000);
      const label = days > 0 ? `D-${days}` : days === 0 ? "D-DAY" : "THANK YOU";
      if (countdownValue.getAttribute("aria-label") !== label) {
        countdownValue.setAttribute("aria-label", label);
        countdownValue.replaceChildren();
        for (const character of label) {
          const slot = document.createElement("span");
          slot.className = "countdown__slot";
          slot.setAttribute("aria-hidden", "true");
          const glyph = document.createElement("span");
          glyph.className = "countdown__glyph";
          glyph.textContent = character === " " ? "\u00a0" : character;
          slot.append(glyph); countdownValue.append(slot);
        }
      }
      countdownCaption.textContent = days > 0
        ? `${content.couple}의 결혼식까지\n${days}일 남았습니다.`
        : days === 0 ? "오늘, 함께 시작합니다." : "함께해 주셔서 감사합니다.";
    }
    updateCountdown();
    window.setInterval(updateCountdown, 60000);
  } else {
    document.querySelector(".date-scene").hidden = true;
    document.querySelector(".countdown__path").hidden = true;
    document.querySelector(".countdown__prelude").hidden = true;
    calendarMonth.textContent = "날짜 준비 중";
    calendarGrid.textContent = "예식 날짜가 정해지면 달력이 표시됩니다.";
  }

  function initCalendarDiagnostics() {
    if (new URLSearchParams(window.location.search).get("calendarDebug") !== "1") return () => {};
    const host = document.getElementById("calendar-diagnostics");
    const output = document.getElementById("calendar-diagnostics-output");
    const report = document.getElementById("calendar-diagnostics-report");
    const storageKey = "wedding-calendar-diagnostics-v1";
    // Only these fixed events are recorded. Never capture URLs, form values,
    // arbitrary console/error messages, cookies, or calendar account data.
    const allowed = {
      load: ["android", "other"], picker: ["normal", "fallback"],
      click: ["calendar-save", "calendar-device", "calendar-google", "calendar-web"],
      fallback: ["device-to-google-app"], visibility: ["visible", "hidden"],
      focus: ["gained", "lost"], pagehide: ["cached", "unloaded"],
      pageshow: ["cached", "loaded"], close: ["picker"], reset: ["manual"]
    };
    let entries = [];
    let storageAvailable = true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
      if (Array.isArray(saved)) entries = saved.filter((entry) =>
        entry && typeof entry.at === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(entry.at) &&
        Object.hasOwn(allowed, entry.event) && allowed[entry.event].includes(entry.value)
      ).slice(-60).map(({ at, event, value }) => ({ at, event, value }));
    } catch { storageAvailable = false; }
    host.hidden = false;
    const scriptSource = new URL(document.currentScript?.src || "script.js", location.href);
    const version = scriptSource.pathname.split("/").pop() + (scriptSource.searchParams.has("v") ? `?v=${scriptSource.searchParams.get("v")}` : "");
    const metadata = {
      format: 1, build: version, userAgent: navigator.userAgent.slice(0, 300),
      language: navigator.language, viewport: `${innerWidth}x${innerHeight}`,
      note: "Visibility/focus changes are observations, not proof of app launch or event save."
    };
    function render() {
      const data = { ...metadata, sessionStorage: storageAvailable, entries };
      output.textContent = JSON.stringify(data, null, 2);
      const issue = new URL("https://github.com/baekmingyu1/Wedding-card/issues/new");
      issue.searchParams.set("title", "[Calendar diagnostic] 캘린더 앱 연결 테스트");
      // Keep the issue link small enough for mobile browsers. Full logs remain visible.
      const recent = entries.slice(-30);
      const updateBody = () => issue.searchParams.set("body", [
        "캘린더 앱 연결 진단입니다. 기기 캘린더와 Google 앱의 실제 동작 결과도 적어 주세요.",
        "화면 전환 기록만으로 앱 실행 또는 일정 저장 성공을 확정할 수 없습니다.",
        "```json", JSON.stringify({ ...data, entries: recent, omitted: entries.length - recent.length }, null, 2), "```"
      ].join("\n\n"));
      updateBody();
      while (issue.href.length > 7500 && recent.length > 1) { recent.shift(); updateBody(); }
      report.href = issue.href;
    }
    function record(event, value) {
      if (!Object.hasOwn(allowed, event) || !allowed[event].includes(value)) return;
      entries.push({ at: new Date().toISOString(), event, value });
      entries = entries.slice(-60);
      try { sessionStorage.setItem(storageKey, JSON.stringify(entries)); }
      catch { storageAvailable = false; }
      render();
    }
    document.addEventListener("click", (event) => {
      const id = event.target.closest?.("a, button")?.id;
      if (allowed.click.includes(id)) record("click", id);
    }, true);
    document.addEventListener("visibilitychange", () => record("visibility", document.visibilityState));
    window.addEventListener("blur", () => record("focus", "lost"));
    window.addEventListener("focus", () => record("focus", "gained"));
    window.addEventListener("pagehide", (event) => record("pagehide", event.persisted ? "cached" : "unloaded"));
    window.addEventListener("pageshow", (event) => record("pageshow", event.persisted ? "cached" : "loaded"));
    document.getElementById("calendar-diagnostics-reset").addEventListener("click", () => {
      entries = [];
      record("reset", "manual");
    });
    record("load", /Android/i.test(navigator.userAgent) || navigator.userAgentData?.platform === "Android" ? "android" : "other");
    return record;
  }
  const recordCalendarDiagnostic = initCalendarDiagnostics();

  const invitationUrl = new URL(window.location.href);
  invitationUrl.hash = "";
  invitationUrl.searchParams.delete("calendarDebug");
  const calendarSave = document.getElementById("calendar-save");
  calendarSave.hidden = !eventReady;
  const calendarPicker = document.getElementById("calendar-picker");
  const calendarAndroid = navigator.userAgentData?.platform === "Android" || /Android/i.test(navigator.userAgent);
  if (eventReady) {
    const start = eventDate.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const googleCalendar = new URL("https://calendar.google.com/calendar/render");
    googleCalendar.search = new URLSearchParams({
      action: "TEMPLATE",
      text: `${content.couple} 결혼식`,
      dates: `${start}/${start}`,
      ctz: "Asia/Seoul",
      location: [content.venue, content.address].filter(Boolean).join(" · "),
      details: `예식 시작: ${content.date} (대한민국 / Asia/Seoul)\n종료 시간은 안내되지 않았습니다. 저장 전 확인해 주세요.`
    }).toString();
    const googleLink = document.getElementById("calendar-google");
    googleLink.href = googleCalendar.href;
    const webLink = document.getElementById("calendar-web");
    webLink.href = googleCalendar.href;
    if (calendarAndroid) {
      const deviceLink = document.getElementById("calendar-device");
      // The browser resolves supported apps; it cannot detect installation or confirm a save.
      // INSERT is supported only if the calendar exposes a browser-accessible activity.
      // Use the browser's fallback, not a timer that could interrupt a successful app launch.
      const googleFallback = `S.browser_fallback_url=${encodeURIComponent(googleCalendar.href)}`;
      const deviceFallback = new URL(window.location.href);
      deviceFallback.hash = "calendar-google";
      deviceLink.href = [
        "intent://com.android.calendar/events#Intent", "scheme=content",
        "action=android.intent.action.INSERT", "type=vnd.android.cursor.dir/event",
        `S.title=${encodeURIComponent(`${content.couple} 결혼식`)}`,
        `S.eventLocation=${encodeURIComponent([content.venue, content.address].filter(Boolean).join(" · "))}`,
        `S.description=${encodeURIComponent(googleCalendar.searchParams.get("details"))}`,
        `l.beginTime=${eventDate.getTime()}`, "B.allDay=false",
        `S.browser_fallback_url=${encodeURIComponent(deviceFallback.href)}`, "end"
      ].join(";");
      googleLink.href = `intent://${googleCalendar.href.slice("https://".length)}#Intent;scheme=https;action=android.intent.action.VIEW;package=com.google.android.calendar;${googleFallback};end`;
      deviceLink.removeAttribute("target");
      googleLink.removeAttribute("target");
      document.getElementById("calendar-device-description").textContent = "설치된 캘린더 앱으로 연결";
      document.getElementById("calendar-google-description").textContent = "Google 캘린더 앱으로 연결";
      document.getElementById("calendar-picker-help").textContent = "기기 캘린더가 열리지 않으면 Google 캘린더 앱을 선택해 주세요.";
      webLink.hidden = false;
    }
  }
  function openCalendarPicker(deviceFailed = false) {
    if (!eventReady) return;
    document.getElementById("calendar-device").hidden = deviceFailed;
    document.getElementById("calendar-web").hidden = !calendarAndroid || deviceFailed;
    document.getElementById("calendar-picker-help").hidden = deviceFailed;
    document.getElementById("calendar-picker-title").textContent = deviceFailed ? "Google 캘린더로 저장" : "어디에 저장할까요?";
    document.getElementById("calendar-picker-description").textContent = deviceFailed
      ? "기본 캘린더를 열지 못했어요. 아래 버튼을 눌러 이어서 저장해 주세요."
      : "사용하실 캘린더를 선택해 주세요.";
    document.querySelector("#calendar-google strong").textContent = deviceFailed ? "Google 캘린더 앱으로 열기" : "Google 캘린더";
    recordCalendarDiagnostic("picker", deviceFailed ? "fallback" : "normal");
    if (!calendarPicker.open) calendarPicker.showModal();
    document.documentElement.classList.add("calendar-picker-open");
    document.getElementById("calendar-picker-title").focus({ preventScroll: true });
  }
  calendarSave.addEventListener("click", () => openCalendarPicker());
  function handleCalendarFallback() {
    if (!calendarAndroid || !eventReady || window.location.hash !== "#calendar-google") return;
    // A second app launch needs a fresh user gesture. A fallback URL cannot safely
    // chain another intent or a timed redirect, so keep the working Google app link.
    recordCalendarDiagnostic("fallback", "device-to-google-app");
    const cleanUrl = new URL(window.location.href);
    cleanUrl.hash = "calendar";
    window.history.replaceState(window.history.state, "", cleanUrl.href);
    openCalendarPicker(true);
  }
  window.addEventListener("hashchange", handleCalendarFallback);
  // Supports both same-document fallback and browsers that reload the fallback URL.
  if (document.readyState === "complete") handleCalendarFallback();
  else window.addEventListener("load", handleCalendarFallback, { once: true });
  document.getElementById("calendar-picker-close").addEventListener("click", () => calendarPicker.close());
  calendarPicker.addEventListener("click", (event) => {
    if (event.target !== calendarPicker) return;
    const rect = calendarPicker.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) calendarPicker.close();
  });
  calendarPicker.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const choices = [...calendarPicker.querySelectorAll("a[href], button, summary")].filter((element) => {
      const details = element.closest("details");
      return !element.closest("[hidden]") && element.getClientRects().length &&
        (!details || details.open || element.tagName === "SUMMARY");
    });
    const index = choices.indexOf(document.activeElement);
    if ((event.shiftKey && index <= 0) || (!event.shiftKey && index === choices.length - 1)) {
      event.preventDefault();
      choices[event.shiftKey ? choices.length - 1 : 0].focus();
    }
  });
  calendarPicker.addEventListener("close", () => {
    recordCalendarDiagnostic("close", "picker");
    document.documentElement.classList.remove("calendar-picker-open");
    calendarSave.focus({ preventScroll: true });
  });

  document.getElementById("copy-link").addEventListener("click", () => copyText(invitationUrl.href));
  document.getElementById("share-invitation").addEventListener("click", async () => {
    if (!navigator.share) { await copyText(invitationUrl.href); return; }
    try {
      await navigator.share({ title: `${content.couple}의 청첩장`, text: "결혼식에 초대합니다.", url: invitationUrl.href });
    } catch (error) {
      if (error?.name !== "AbortError") showToast("전달할 수 없습니다. 주소 복사를 이용해 주세요.");
    }
  });

  for (const groupName of ["신랑 측", "신부 측"]) {
    const group = document.createElement("details");
    group.className = "account__group";
    const summary = document.createElement("summary");
    summary.textContent = groupName;
    const body = document.createElement("div");
    body.className = "account__group-body";
    const readyAccounts = (content.accounts || []).filter((account) =>
      account.side === groupName && account.bank && account.number && account.holder
    );

    for (const account of readyAccounts) {
      const card = document.createElement("article");
      card.className = "account__card";
      const label = document.createElement("p");
      label.className = "account__side";
      label.textContent = account.label || groupName;
      const details = document.createElement("p");
      details.className = "account__details";
      const number = document.createElement("strong");
      number.textContent = account.number;
      const bank = document.createElement("span");
      bank.className = "account__bank";
      bank.textContent = account.bank;
      const holder = document.createElement("span");
      holder.className = "account__holder";
      holder.textContent = account.holder;
      holder.setAttribute("aria-label", `예금주 ${account.holder}`);
      const meta = document.createElement("span");
      meta.className = "account__meta";
      const separator = document.createElement("span");
      separator.textContent = "·";
      separator.setAttribute("aria-hidden", "true");
      meta.append(bank, separator, holder);
      details.append(number, meta);
      const button = document.createElement("button");
      button.className = "button button--light";
      button.type = "button";
      button.textContent = "복사 ↗";
      button.setAttribute("aria-label", `${account.label || groupName} 계좌번호 복사`);
      button.addEventListener("click", () => copyText(account.number));
      card.append(label, details, button);
      body.append(card);
    }

    if (!readyAccounts.length) {
      const empty = document.createElement("p");
      empty.className = "account__empty";
      empty.textContent = "계좌 정보 준비 중";
      body.append(empty);
    }
    group.append(summary, body);
    accountHost.append(group);
  }

  const bgm = document.getElementById("wedding-bgm");
  const bgmButton = document.getElementById("bgm-toggle");
  let bgmStarted = false;
  let bgmMuted = false;
  let bgmBlocked = false;
  let bgmSuspended = false;
  let bgmAttempt = 0;
  function renderBgm() {
    const audible = bgmStarted && !bgmMuted && !bgmBlocked && !bgm.paused;
    bgmButton.title = audible ? "배경음악 음소거" : "배경음악 켜기";
    bgmButton.setAttribute("aria-label", audible ? "배경음악 음소거" : "배경음악 켜기");
    bgmButton.setAttribute("aria-pressed", String(audible));
  }
  function playBgm() {
    if (!bgmStarted || bgmSuspended || document.hidden) return;
    const attempt = ++bgmAttempt;
    bgm.muted = bgmMuted;
    bgm.play().then(() => {
      if (attempt !== bgmAttempt) return;
      bgmBlocked = false;
      renderBgm();
    }).catch(() => {
      if (attempt !== bgmAttempt) return;
      bgmBlocked = true;
      renderBgm();
    });
  }
  function prepareBgm() {
    bgmAttempt += 1;
    bgmStarted = false;
    bgmSuspended = false;
    bgmButton.hidden = true;
    bgm.muted = true;
    // Called synchronously by the invitation/replay tap to unlock mobile audio.
    bgm.play().catch(() => {});
  }
  function startBgm() {
    bgm.pause();
    bgm.currentTime = 0;
    bgmStarted = true;
    bgmButton.hidden = false;
    playBgm();
  }
  bgmButton.addEventListener("click", () => {
    if (bgmBlocked || bgm.paused) bgmMuted = false;
    else bgmMuted = !bgmMuted;
    bgm.muted = bgmMuted;
    playBgm();
    renderBgm();
  });
  document.addEventListener("pointerup", (event) => {
    if (bgmBlocked && !bgmMuted && !event.target.closest("#bgm-toggle")) playBgm();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { bgm.pause(); renderBgm(); }
    else playBgm();
  });
  window.addEventListener("pagehide", () => { bgmAttempt += 1; bgm.pause(); });
  window.addEventListener("pageshow", () => playBgm());
  bgm.addEventListener("error", () => {
    bgmButton.disabled = true;
    bgmButton.setAttribute("aria-pressed", "false");
    bgmButton.setAttribute("aria-label", "음악을 불러올 수 없어요");
    bgmButton.title = "음악을 불러올 수 없어요";
  });

  const opening = document.getElementById("opening");
  const frames = [...frameHost.children];
  const openingCopy = document.querySelector(".opening__copy");
  const openingFinal = document.getElementById("opening-final");
  const openingLoader = document.getElementById("opening-loader");
  const loaderCount = document.getElementById("opening-loader-count");
  const loaderProgress = document.getElementById("opening-loader-progress");
  const openingCount = document.getElementById("opening-count");
  const openingProgress = document.getElementById("opening-progress");
  const skipButton = document.getElementById("opening-skip");
  const sections = ["opening", "invitation", "calendar", "countdown", "gallery", "rsvp", "couple", "account", "location", "directions", "wreath", "share"]
    .map((id) => document.getElementById(id));
  const firstSection = document.getElementById("invitation");
  const sideNav = document.querySelector(".side-nav");
  const navProgress = document.getElementById("nav-progress");
  const links = [...document.querySelectorAll("[data-nav]")];
  const startAtOpening = window.scrollY < 10 && (!location.hash || location.hash === "#opening") &&
    !galleryDialog.open;
  let autoplayActive = startAtOpening && !welcomeWanted && !resumeInvitation && !motionReduced.matches;
  let playbackComplete = false;
  let autoplayIndex = 0;
  let playbackRun = 0;
  let hasLeftOpening = false;
  let paintedScene = -1;
  let frameLayer = 0;
  let cancelFrameCleanup = () => {};
  let finalMessageReady = false;
  let pending = false;
  const loadQueue = [];
  const frameRequests = new Map();
  let activeLoads = 0;
  let loadsEnabled = true;
  const maxConcurrentLoads = 3;
  let openingLocked = false;
  const openingInertState = new Map();
  const bodySections = [...document.querySelectorAll("main > :not(#opening), .footer, .side-nav, #gallery-dialog")];
  const instantOpeningTop = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  function setOpeningLocked(locked) {
    if (openingLocked === locked) return;
    openingLocked = locked;
    document.documentElement.classList.toggle("opening-scroll-locked", locked);
    if (locked) {
      for (const element of bodySections) {
        openingInertState.set(element, element.inert);
        element.inert = true;
      }
      instantOpeningTop();
      if (document.activeElement !== document.body && !opening.contains(document.activeElement) &&
          !document.activeElement.matches(".skip-link, #bgm-toggle")) skipButton.focus({ preventScroll: true });
    } else {
      for (const [element, inert] of openingInertState) element.inert = inert;
      openingInertState.clear();
    }
  }
  window.addEventListener("wheel", (event) => {
    if (openingLocked && !event.ctrlKey) event.preventDefault();
  }, { passive: false });
  window.addEventListener("touchmove", (event) => {
    if (openingLocked && event.touches.length === 1 && (window.visualViewport?.scale || 1) <= 1) event.preventDefault();
  }, { passive: false });
  document.addEventListener("keydown", (event) => {
    if (!openingLocked) return;
    const scrollKeys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
    if (scrollKeys.includes(event.key) && !(event.key === " " && event.target.closest("button"))) event.preventDefault();
  });
  document.addEventListener("focusin", (event) => {
    if (openingLocked && !opening.contains(event.target) && !event.target.matches(".skip-link, #bgm-toggle")) {
      skipButton.focus({ preventScroll: true });
    }
  });
  // Release DOM state when leaving; reapply it if a running intro is restored from BFCache.
  window.addEventListener("pagehide", () => setOpeningLocked(false));
  window.addEventListener("pageshow", () => {
    if (autoplayActive) setOpeningLocked(true);
  });
  setOpeningLocked(autoplayActive);
  openingLoader.hidden = !autoplayActive;

  if (welcomeWanted || autoplayActive || motionReduced.matches) {
    opening.classList.add("opening--short");
  } else {
    // Keep the original scroll-driven sequence for deep links and restored scroll positions.
    opening.style.setProperty("--sequence-height", `${Math.max(300, 170 + openingPhotos.length * 22)}svh`);
  }

  function loadOpeningFrame(index, highPriority = false) {
    const image = frames[index]?.querySelector("img[data-src]");
    if (!image) return;
    if (highPriority) image.fetchPriority = "high";
    const source = frames[index].querySelector("source[data-srcset]");
    if (source) {
      source.srcset = source.dataset.srcset;
      delete source.dataset.srcset;
    }
    if (image.dataset.srcset) {
      image.srcset = image.dataset.srcset;
      delete image.dataset.srcset;
    }
    image.src = image.dataset.src;
    delete image.dataset.src;
  }

  function keepPreviousUntilCovered(next) {
    cancelFrameCleanup();
    let timer;
    let paint;
    let cancelled = false;
    const deadline = performance.now() + 1200;
    const cleanup = () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(paint);
      next.removeEventListener("transitionend", checkCoverage);
      next.removeEventListener("transitioncancel", checkCoverage);
    };
    function checkCoverage() {
      if (cancelled || next !== frames[paintedScene]) return;
      clearTimeout(timer);
      if (!document.hidden && Number(getComputedStyle(next).opacity) >= 1) {
        // Keep the old photo through a rendering opportunity after the fade.
        if (!paint) paint = requestAnimationFrame(() => {
          paint = 0;
          if (cancelled || document.hidden || next !== frames[paintedScene]) { checkCoverage(); return; }
          if (Number(getComputedStyle(next).opacity) < 1) { checkCoverage(); return; }
          for (const frame of frames) {
            if (frame === next) continue;
            frame.style.opacity = "0";
            frame.style.visibility = "hidden";
          }
          cleanup();
        });
      } else {
        if (!document.hidden && performance.now() >= deadline) {
          // A missing/cancelled transition must not stall playback or expose the backdrop.
          const transition = next.style.transition;
          next.style.transition = "none";
          next.style.opacity = "1";
          void getComputedStyle(next).opacity;
          next.style.transition = transition;
        }
        timer = setTimeout(checkCoverage, 50);
      }
    }
    cancelFrameCleanup = cleanup;
    next.addEventListener("transitionend", checkCoverage);
    next.addEventListener("transitioncancel", checkCoverage);
    checkCoverage();
  }

  function decodeOpeningForPlayback(index) {
    const frame = frames[index];
    const image = frame?.querySelector("img");
    if (frame?.dataset.status !== "ready" || !image?.complete || !image.naturalWidth) return Promise.resolve(false);
    const source = image.currentSrc;
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 1800);
      Promise.resolve().then(() => image.decode?.()).then(() => {
        clearTimeout(timer);
        resolve(image.complete && image.naturalWidth > 0 && image.currentSrc === source);
      }, () => { clearTimeout(timer); resolve(false); });
    });
  }

  function updateScroll() {
    pending = false;
    if (openingLocked && window.scrollY !== 0) instantOpeningTop();
    if (!photoDialogActive && !photoHistoryPending && !photoRestorePending && playbackComplete && hasLeftOpening && window.scrollY < 5) {
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
    const sceneIndex = motionReduced.matches
      ? 0
      : playbackComplete || autoplayActive
        ? autoplayIndex
        : Math.min(frames.length - 1, Math.floor(sequenceProgress * frames.length));
    const openingVisible = openingRect.bottom > 0 && openingRect.top < window.innerHeight;
    const showSideNav = !openingLocked && firstSection.getBoundingClientRect().top <= 0;
    let active = "opening";
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= window.innerHeight * .45) active = section.id;
    }
    const pageRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const navProgressHeight = `${Math.min(100, window.scrollY / pageRange * 100)}%`;
    if (openingVisible || autoplayActive) {
      if (!autoplayActive && !playbackComplete) {
        requestOpeningFrame(sceneIndex, true);
        if (!motionReduced.matches) {
          requestOpeningFrame(sceneIndex + 1);
          requestOpeningFrame(sceneIndex + 2);
        }
      }
      const displayIndex = frames[sceneIndex].dataset.status === "ready" ||
        frames[sceneIndex].dataset.status === "failed" || paintedScene < 0
        ? sceneIndex : paintedScene;
      if (displayIndex !== paintedScene) {
        const next = frames[displayIndex];
        next.style.zIndex = String(++frameLayer);
        next.style.visibility = "visible";
        next.style.opacity = "1";
        paintedScene = displayIndex;
        openingCount.textContent = `${String(displayIndex + 1).padStart(2, "0")} / ${String(frames.length).padStart(2, "0")}`;
        keepPreviousUntilCovered(next);
      }
      openingCopy.style.opacity = motionReduced.matches ? "1" : autoplayActive || playbackComplete
        ? (sceneIndex === 0 ? "1" : "0")
        : Math.max(0, 1 - progress / (introEnd * .8));
      const showFinal = !motionReduced.matches && openingVisible && (
        autoplayActive || playbackComplete ? finalMessageReady : sceneIndex === frames.length - 1
      );
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

  function requestOpeningFrame(index, highPriority = false) {
    const frame = frames[index];
    if (!frame || frame.dataset.status === "failed") return Promise.resolve(false);
    if (frame.dataset.status === "ready") return Promise.resolve(true);
    if (frameRequests.has(index)) return frameRequests.get(index);
    let resolveRequest;
    const promise = new Promise((resolve) => { resolveRequest = resolve; });
    frameRequests.set(index, promise);
    loadQueue.push({ index, highPriority, resolve: resolveRequest });
    pumpOpeningLoads();
    return promise;
  }

  function pumpOpeningLoads() {
    while (loadsEnabled && activeLoads < maxConcurrentLoads && loadQueue.length) {
      const job = loadQueue.shift();
      const frame = frames[job.index];
      activeLoads += 1;
      frame.dataset.status = "loading";
      const timeout = window.setTimeout(() => {
        if (frame.dataset.status !== "loading") return;
        frame.dataset.status = "failed";
        const placeholder = frame.querySelector(".opening__placeholder");
        if (placeholder) placeholder.textContent = `SCENE ${String(job.index + 1).padStart(2, "0")} · 사진을 불러올 수 없습니다`;
        frame.dispatchEvent(new Event("frame-settled"));
      }, 8000);
      frame.addEventListener("frame-settled", () => {
        window.clearTimeout(timeout);
        activeLoads -= 1;
        frameRequests.delete(job.index);
        job.resolve(frame.dataset.status === "ready");
        pumpOpeningLoads();
      }, { once: true });
      loadOpeningFrame(job.index, job.highPriority);
    }
  }

  function stopPendingOpeningLoads() {
    loadsEnabled = false;
    for (const job of loadQueue.splice(0)) {
      frameRequests.delete(job.index);
      job.resolve(false);
    }
  }

  function finishOpening(navigate = true) {
    if (!autoplayActive) return;
    playbackRun += 1;
    cancelFrameCleanup();
    autoplayActive = false;
    setOpeningLocked(false);
    playbackComplete = true;
    bgmSuspended = false;
    if (bgmStarted) playBgm();
    else { bgmAttempt += 1; bgm.pause(); }
    hasLeftOpening = false;
    stopPendingOpeningLoads();
    openingLoader.hidden = true;
    openingLoader.classList.remove("is-exiting");
    updateScroll();
    preloadGallery();
    if (navigate) navigateToInvitation();
  }

  function replayOpening() {
    prepareBgm();
    opening.hidden = false;
    if (galleryDialog.open) return;
    playbackRun += 1;
    cancelFrameCleanup();
    autoplayActive = !motionReduced.matches;
    playbackComplete = false;
    hasLeftOpening = false;
    autoplayIndex = 0;
    finalMessageReady = false;
    loadsEnabled = true;
    pumpOpeningLoads();
    opening.classList.add("opening--short");
    opening.style.removeProperty("--sequence-height");
    openingLoader.classList.remove("is-exiting");
    openingLoader.hidden = !autoplayActive || frames.every((frame) => ["ready", "failed"].includes(frame.dataset.status));
    setOpeningLocked(autoplayActive);
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previousScrollBehavior;
    if (location.hash !== "#opening") {
      try { history.replaceState(null, "", "#opening"); }
      catch { /* Replay still works when local file history is unavailable. */ }
    }
    requestOpeningFrame(0, true);
    updateScroll();
    if (autoplayActive) playOpening(playbackRun);
    else { startBgm(); preloadGallery(); }
  }

  document.querySelectorAll('a[href="#opening"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      replayOpening();
    });
  });

  function navigateToInvitation() {
    firstSection.tabIndex = -1;
    firstSection.focus({ preventScroll: true });
    window.requestAnimationFrame(() => firstSection.scrollIntoView({ behavior: motionReduced.matches ? "instant" : "smooth" }));
  }
  function skipOpening(event) {
    event.preventDefault();
    if (autoplayActive) finishOpening();
    else navigateToInvitation();
  }
  document.querySelector(".skip-link").addEventListener("click", skipOpening);

  motionReduced.addEventListener("change", () => {
    if (!motionReduced.matches || !autoplayActive) return;
    finishOpening(false);
    loadsEnabled = true;
    requestOpeningFrame(0, true);
    updateScroll();
  });

  skipButton.addEventListener("click", skipOpening);

  async function waitPlayback(milliseconds, run) {
    let remaining = milliseconds;
    while (remaining > 0 && autoplayActive && run === playbackRun) {
      const started = performance.now();
      await new Promise((resolve) => window.setTimeout(resolve, Math.min(remaining, 80)));
      if (!document.hidden) remaining -= performance.now() - started;
    }
  }

  async function waitUntilActive(run) {
    while (document.hidden && autoplayActive && run === playbackRun) {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
  }

  async function playOpening(run) {
    if (!autoplayActive || run !== playbackRun) return;
    let settled = 0;
    loaderCount.textContent = `00 / ${String(frames.length).padStart(2, "0")}`;
    loaderProgress.style.width = "0%";
    const prepared = frames.map((_, index) =>
      requestOpeningFrame(index, index === 0).then(() => {
        settled += 1;
        if (autoplayActive && run === playbackRun) {
          loaderCount.textContent = `${String(settled).padStart(2, "0")} / ${String(frames.length).padStart(2, "0")}`;
          loaderProgress.style.width = `${settled / frames.length * 100}%`;
        }
      })
    );
    await Promise.all(prepared);
    await waitUntilActive(run);
    if (!autoplayActive || run !== playbackRun) return;
    if (!openingLoader.hidden) {
      openingLoader.classList.add("is-exiting");
      await waitPlayback(550, run);
      if (!autoplayActive || run !== playbackRun) return;
      openingLoader.hidden = true;
    }
    preloadGallery();
    const middleFrameMs = 200;
    const preparedNext = new Map();
    const warmNext = (index) => {
      if (index < frames.length && !preparedNext.has(index)) preparedNext.set(index, decodeOpeningForPlayback(index));
    };
    warmNext(0);
    for (let index = 0; index < frames.length && autoplayActive && run === playbackRun; index += 1) {
      await waitUntilActive(run);
      if (!autoplayActive || run !== playbackRun) return;
      // Prepare the next photo while the current one stays visible, then recheck
      // decoding at handoff instead of relying on a much earlier preload.
      warmNext(index);
      const prepared = await preparedNext.get(index);
      const ready = prepared && await decodeOpeningForPlayback(index);
      await waitUntilActive(run);
      if (!autoplayActive || run !== playbackRun) return;
      warmNext(index + 1);
      if (ready) {
        if (index === 0) startBgm();
        autoplayIndex = index;
        updateScroll();
      }
      if (index === frames.length - 1) {
        // Let the last photo settle before revealing the closing line.
        await waitPlayback(500, run);
        if (!autoplayActive || run !== playbackRun) return;
        finalMessageReady = true;
        updateScroll();
      }
      await waitPlayback(index === 0 ? 1300 : index === frames.length - 1 ? 3200 : middleFrameMs, run);
    }
    if (run === playbackRun) finishOpening();
  }

  const welcomeChoice = document.getElementById("welcome-choice");
  const welcomeStory = document.getElementById("welcome-story");
  const welcomeRsvp = document.getElementById("welcome-rsvp");
  const welcomeBack = document.getElementById("welcome-back");
  const welcomeEnter = document.getElementById("welcome-enter");
  const rsvpHome = document.getElementById("rsvp-disclosure");
  const rsvpContent = rsvpForm.parentElement;
  const quiz = Array.isArray(content.welcomeQuiz) ? content.welcomeQuiz : [];
  let storyIndex = 0;

  function restoreRsvp() {
    rsvpHome.append(rsvpContent);
  }
  function showWelcomeStep(step) {
    welcomeChoice.hidden = step !== "choice";
    welcomeStory.hidden = step !== "story";
    welcomeRsvp.hidden = step !== "rsvp";
    welcomeBack.hidden = step === "choice";
    welcomeEnter.textContent = "청첩장 보기";
    welcomeEnter.className = step === "choice" ? "welcome__text-button" : "button button--light";
    document.getElementById("welcome-next").hidden = step !== "story";
    document.getElementById("welcome-rsvp-skip").hidden = step !== "story" || storyIndex >= quiz.length - 1;
    welcomeDialog.scrollTop = 0;
    const title = document.getElementById(step === "choice" ? "welcome-title" : step === "story" ? "welcome-question" : "welcome-rsvp-title");
    welcomeDialog.setAttribute("aria-labelledby", title.id);
    title.focus({ preventScroll: true });
  }
  function showWelcomeRsvp() {
    document.getElementById("welcome-rsvp-slot").append(rsvpContent);
    showWelcomeStep("rsvp");
  }
  function showStory() {
    if (storyIndex >= quiz.length) { showWelcomeRsvp(); return; }
    const item = quiz[storyIndex];
    document.getElementById("welcome-question").textContent = item.question || "우리의 이야기";
    document.getElementById("welcome-step").textContent = `${storyIndex + 1} / ${quiz.length} · 우리의 이야기`;
    const answers = document.getElementById("welcome-answers");
    const reveal = document.getElementById("welcome-reveal");
    answers.replaceChildren();
    reveal.hidden = true;
    reveal.textContent = "";
    const options = Array.isArray(item.options) ? item.options : [];
    document.getElementById("welcome-story-pending").hidden = options.length > 0;
    for (const option of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        for (const sibling of answers.children) sibling.setAttribute("aria-pressed", String(sibling === button));
        reveal.textContent = item.story || "두 사람의 이야기를 준비하고 있어요.";
        reveal.hidden = false;
      });
      answers.append(button);
    }
    document.getElementById("welcome-next").textContent = storyIndex === quiz.length - 1 ? "참석 여부 알려주기" : "다음 이야기";
    showWelcomeStep("story");
  }
  function enterOpening() {
    rememberGuest(rememberedGuest || "direct");
    restoreRsvp();
    welcomeDialog.close();
    document.documentElement.classList.remove("welcome-open");
    replayOpening();
    opening.tabIndex = -1;
    opening.focus({ preventScroll: true });
  }
  function enterInvitation() {
    rememberGuest(rememberedGuest || "direct");
    restoreRsvp();
    welcomeDialog.close();
    document.documentElement.classList.remove("welcome-open");
    // Enter directly, without starting the photo intro or an intermediate notice.
    opening.hidden = true;
    stopPendingOpeningLoads();
    preloadGallery();
    firstSection.tabIndex = -1;
    firstSection.focus({ preventScroll: true });
    firstSection.scrollIntoView({ behavior: "instant", block: "start" });
    scheduleUpdate();
  }
  welcomeDialog.querySelectorAll("[data-guest]").forEach((button) => {
    button.addEventListener("click", () => {
      rememberGuest(button.dataset.guest);
      if (button.dataset.guest === "parents") { enterOpening(); return; }
      storyIndex = 0;
      showStory();
    });
  });
  document.getElementById("welcome-next").addEventListener("click", () => { storyIndex += 1; showStory(); });
  document.getElementById("welcome-rsvp-skip").addEventListener("click", showWelcomeRsvp);
  welcomeBack.addEventListener("click", () => {
    rememberGuest("");
    restoreRsvp();
    rsvpForm.querySelectorAll('[name="side"]').forEach((input) => { input.checked = false; });
    showWelcomeStep("choice");
  });
  welcomeEnter.addEventListener("click", enterOpening);
  welcomeDialog.addEventListener("cancel", (event) => { event.preventDefault(); enterInvitation(); });
  if (welcomeWanted && !galleryDialog.open) {
    document.documentElement.classList.add("welcome-open");
    welcomeDialog.showModal();
    showWelcomeStep("choice");
    // Reuse the real image elements and the existing three-request loading queue.
    // Avoid downloading the entire sequence for data-saving connections.
    if (!navigator.connection?.saveData) frames.forEach((_, index) => requestOpeningFrame(index));
  }

  // Progressive enhancement: content is always visible without observers or animation support.
  function initContentMotion() {
    const running = new Map();
    const play = (target, frames, timing) => {
      running.get(target)?.cancel();
      const animation = target.animate(frames, { fill: "backwards", ...timing });
      running.set(target, animation);
      const clear = () => { if (running.get(target) === animation) running.delete(target); };
      animation.addEventListener("finish", clear, { once: true });
      animation.addEventListener("cancel", clear, { once: true });
      return animation;
    };
    const rise = (target, delay = 0, distance = 18, duration = 700) => play(target,
      [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: "translateY(0)" }],
      { duration, delay, easing: "cubic-bezier(.22,1,.36,1)" });
    const revealDate = (sheet) => {
      sheet.querySelectorAll(".date-scene__part, .date-scene__separator").forEach((part, i) => rise(part, i * 110, 32, 950));
      sheet.querySelectorAll(".calendar__weekday, .calendar__day").forEach((cell, i) => rise(cell, 160 + i * 12, 8, 450));
      const ring = sheet.querySelector(".calendar__event-ring circle");
      if (ring) play(ring, [{ strokeDashoffset: "1" }, { strokeDashoffset: "0" }],
        { duration: 850, delay: 650, easing: "cubic-bezier(.2,.7,.2,1)" });
      rise(sheet.querySelector(".calendar__caption"), 750, 12, 700);
    };
    const revealCountdown = (section) => {
      section.querySelectorAll(".countdown__path path").forEach((path, i) => play(path,
        [{ strokeDashoffset: "1" }, { strokeDashoffset: "0" }],
        { duration: 1000, delay: i * 120, easing: "ease-in-out" }));
      section.querySelectorAll(".countdown__glyph").forEach((glyph, i) => rise(glyph, 350 + i * 65, 65, 900));
      rise(section.querySelector("#countdown-caption"), 600, 12, 700);
    };
    const seen = new WeakSet();
    const revealTargets = ".pace-mark, .invitation__message p, .calendar__sheet, #calendar-save, .countdown__inner, .gallery__item, .rsvp-disclosure, .couple__person, .account__group, .location__map-heading, .directions__map, .directions__links, .directions__item, .wreath__inner, .share__inner";
    if (typeof IntersectionObserver === "function" && Element.prototype.animate) {
      const observer = new IntersectionObserver((entries) => {
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting) continue;
          observer.unobserve(target);
          if (seen.has(target)) continue;
          seen.add(target);
          if (motionReduced.matches || document.hidden || target.contains(document.activeElement)) continue;
          if (target.matches(".calendar__sheet") && eventReady) { revealDate(target); continue; }
          if (target.matches(".countdown__inner") && eventReady) { revealCountdown(target); continue; }
          if (target.matches(".gallery__item")) {
            const position = Array.from(galleryHost.children).indexOf(target);
            rise(target, Math.max(0, position) * 65, 24, 800);
            continue;
          }
          if (target.matches(".pace-mark")) {
            for (const path of target.querySelectorAll("path")) {
              const draw = path.animate([{ strokeDasharray: "1", strokeDashoffset: "1" }, { strokeDasharray: "1", strokeDashoffset: "0" }], { duration: 1400, easing: "ease-in-out" });
              running.set(path, draw);
              const clearDraw = () => running.delete(path);
              draw.addEventListener("finish", clearDraw, { once: true });
              draw.addEventListener("cancel", clearDraw, { once: true });
            }
          }
          const editorial = target.matches(".invitation__message p, .gallery__item");
          const animation = target.animate([
            { opacity: editorial ? 0 : .45, transform: editorial ? "translateY(24px)" : "translateY(10px)" },
            { opacity: 1, transform: "translateY(0)" }
          ], { duration: editorial ? 850 : 320, easing: "cubic-bezier(.2,.7,.2,1)" });
          running.set(target, animation);
          const clear = () => { if (running.get(target) === animation) running.delete(target); };
          animation.addEventListener("finish", clear, { once: true });
          animation.addEventListener("cancel", clear, { once: true });
        }
      }, { threshold: .08, rootMargin: "0px 0px -12px 0px" });
      document.querySelectorAll(revealTargets).forEach((element) => observer.observe(element));
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.removedNodes) if (node.nodeType === 1) observer.unobserve(node);
          for (const node of record.addedNodes) if (node.nodeType === 1 && node.matches(".gallery__item")) observer.observe(node);
        }
      }).observe(galleryHost, { childList: true });
      document.addEventListener("focusin", (event) => {
        for (const [target, animation] of running) if (target.contains(event.target)) animation.cancel();
      });
      const finishMotion = () => { for (const animation of running.values()) animation.cancel(); };
      motionReduced.addEventListener("change", () => { if (motionReduced.matches) finishMotion(); });
      document.addEventListener("visibilitychange", () => { if (document.hidden) finishMotion(); });
      rsvpForm.addEventListener("change", (event) => {
        if (!event.target.matches('input[type="radio"]') || motionReduced.matches || document.hidden) return;
        const face = event.target.nextElementSibling;
        play(face, [{ transform: "scale(.96)" }, { transform: "scale(1)" }],
          { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" });
      });
    }

    document.querySelectorAll(".rsvp-disclosure, .account__group").forEach((details) => {
      const summary = details.querySelector("summary");
      let animation = null;
      let targetOpen = details.open;
      summary.addEventListener("click", (event) => {
        if (motionReduced.matches || !details.animate) return;
        event.preventDefault();
        const from = details.getBoundingClientRect().height;
        targetOpen = animation ? !targetOpen : !details.open;
        animation?.cancel();
        details.open = false;
        const collapsed = details.getBoundingClientRect().height;
        details.open = true;
        const expanded = details.getBoundingClientRect().height;
        details.style.overflow = "hidden";
        const current = details.animate([
          { height: `${from}px` },
          { height: `${targetOpen ? expanded : collapsed}px` }
        ], { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" });
        animation = current;
        current.onfinish = () => {
          if (animation !== current) return;
          details.open = targetOpen;
          details.style.removeProperty("overflow");
          animation = null;
        };
      });
      motionReduced.addEventListener("change", () => {
        if (motionReduced.matches) animation?.finish();
      });
    });
  }
  initContentMotion();

  if (resumeInvitation && !galleryDialog.open) enterInvitation();
  if (autoplayActive) playOpening(++playbackRun);
  else if (!welcomeWanted) preloadGallery();
})();
