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
          try { await img.decode(); } catch { /* The loaded image can still be displayed. */ }
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
      button.addEventListener("click", () => openGalleryPhoto(index));
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
  const galleryPageSize = 8;
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
  const photoHistoryKey = "weddingGalleryPhoto";
  const historyPhotoIndex = () => {
    const index = history.state?.[photoHistoryKey];
    return Number.isInteger(index) && index >= 0 && index < galleryPhotos.length ? index : null;
  };
  const resolveGalleryPhoto = (index) => galleryPhotos[index] || openingPhotos[
    Math.round(index * (openingPhotos.length - 1) / Math.max(1, galleryPhotos.length - 1))
  ];

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

  function openGalleryPhoto(index, fromHistory = false) {
    // Closing traverses history asynchronously; do not create another entry meanwhile.
    if (photoHistoryPending) return;
    if (!galleryDialog.open) {
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
  function closeGalleryPhoto() {
    if (!photoDialogActive) return;
    photoDialogActive = false;
    galleryDialog.close();
    document.body.style.overflow = previousBodyOverflow;
    ++photoRequest;
    window.clearTimeout(photoLoadingTimer);
    photoStatus.textContent = "";
    photoStage.replaceChildren();
    swipeStart = null;
    lastPhotoTap = null;
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
    if (index === null) closeGalleryPhoto();
    else openGalleryPhoto(index, true);
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
    galleryHost.classList.toggle("gallery__grid--odd", photos.length % 2 === 1);
    photos.forEach((photo, offset) => {
      const index = start + offset;
      const mobileSize = offset === 0 && photos.length % 2 === 1
        ? "calc(100vw - 104px)" : "calc((100vw - 114px) / 2)";
      const sizes = "(max-width: 760px) " + mobileSize + ", (max-width: 1220px) calc((100vw - 88px) / 3), 378px";
      addPhoto(galleryHost, resolveGalleryPhoto(index), index, "gallery", sizes);
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

  const hasMaps = [
    setExternalLink("naver-map-link", content.naverMapUrl),
    setExternalLink("kakao-map-link", content.kakaoMapUrl),
    setExternalLink("google-map-link", content.googleMapUrl)
  ].some(Boolean);
  document.getElementById("map-pending").hidden = hasMaps;
  const naverStaticMap = document.getElementById("naver-static-map");
  const naverStaticImage = document.getElementById("naver-static-map-image");
  const naverKeyId = content.naverStaticMapKeyId?.trim();
  const naverCenter = content.naverStaticMapCenter?.trim();
  if (naverKeyId && naverCenter && /^https?:$/.test(location.protocol)) {
    const coordinates = naverCenter.split(",").map(Number);
    if (coordinates.length === 2 && coordinates.every(Number.isFinite)) {
      const [longitude, latitude] = coordinates;
      const params = new URLSearchParams({
        w: "900", h: "580", center: naverCenter, level: "16", lang: "ko",
        markers: `type:d|size:mid|color:Orange|pos:${longitude} ${latitude}`,
        "X-NCP-APIGW-API-KEY-ID": naverKeyId
      });
      const naverPreview = document.getElementById("naver-static-map-preview");
      naverPreview.href = document.getElementById("naver-map-link").href;
      naverStaticImage.addEventListener("error", () => { naverStaticMap.hidden = true; }, { once: true });
      naverStaticMap.hidden = false;
      naverStaticImage.src = `https://maps.apigw.ntruss.com/map-static/v2/raster-cors?${params}`;
    }
  }
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
      rsvpForm.elements[name].disabled = !attending;
      rsvpForm.elements[name].required = attending;
    }
  }
  rsvpForm.elements.attendance.addEventListener("change", updateAttendance);
  updateAttendance();
  rsvpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!rsvpReady || rsvpBusy || !rsvpForm.reportValidity()) return;
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
      if (date === day) {
        cell.className = "calendar__day--event";
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
      countdownValue.textContent = days > 0 ? `D-${days}` : days === 0 ? "D-DAY" : "THANK YOU";
      countdownCaption.textContent = days > 0
        ? `${content.couple}의 결혼식까지 ${days}일 남았습니다.`
        : days === 0 ? "오늘, 함께 시작합니다." : "함께해 주셔서 감사합니다.";
    }
    updateCountdown();
    window.setInterval(updateCountdown, 60000);
  } else {
    calendarMonth.textContent = "날짜 준비 중";
    calendarGrid.textContent = "예식 날짜가 정해지면 달력이 표시됩니다.";
  }

  const invitationUrl = new URL(window.location.href);
  invitationUrl.hash = "";
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
      details.append(number, document.createTextNode(`${account.bank} · 예금주 ${account.holder}`));
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

  const opening = document.getElementById("opening");
  const frames = [...frameHost.children];
  const openingCopy = document.querySelector(".opening__copy");
  const openingFinal = document.getElementById("opening-final");
  const openingLoader = document.getElementById("opening-loader");
  const loaderCount = document.getElementById("opening-loader-count");
  const loaderProgress = document.getElementById("opening-loader-progress");
  const openingCount = document.getElementById("opening-count");
  const openingProgress = document.getElementById("opening-progress");
  const openingStatus = document.getElementById("opening-status");
  const pauseButton = document.getElementById("opening-pause");
  const skipButton = document.getElementById("opening-skip");
  const sections = ["opening", "invitation", "calendar", "countdown", "gallery", "rsvp", "couple", "account", "location", "directions", "wreath", "share"]
    .map((id) => document.getElementById(id));
  const firstSection = document.getElementById("invitation");
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
  let frameLayer = 0;
  let finalMessageReady = false;
  let pending = false;
  const loadQueue = [];
  const frameRequests = new Map();
  let activeLoads = 0;
  let loadsEnabled = true;
  const maxConcurrentLoads = 3;
  openingLoader.hidden = !autoplayActive;

  if (autoplayActive || motionReduced.matches) {
    opening.classList.add("opening--short");
  } else {
    // Keep the original scroll-driven sequence for deep links and restored scroll positions.
    opening.style.setProperty("--sequence-height", `${Math.max(300, 170 + openingPhotos.length * 22)}svh`);
    openingStatus.textContent = "SCROLL TO MEET ↓";
  }
  if (motionReduced.matches) openingStatus.textContent = "아래로 스크롤 ↓";

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

  function updateScroll() {
    pending = false;
    if (autoplayActive && window.scrollY > Math.max(80, window.innerHeight * .25)) {
      finishOpening(false);
      return;
    }
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
    const sceneIndex = motionReduced.matches
      ? 0
      : playbackComplete || autoplayActive
        ? autoplayIndex
        : Math.min(frames.length - 1, Math.floor(sequenceProgress * frames.length));
    const openingVisible = openingRect.bottom > 0 && openingRect.top < window.innerHeight;
    const showSideNav = firstSection.getBoundingClientRect().top <= 0;
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
        const previous = frames[paintedScene];
        const next = frames[displayIndex];
        next.style.zIndex = String(++frameLayer);
        next.style.visibility = "visible";
        next.style.opacity = "1";
        paintedScene = displayIndex;
        openingCount.textContent = `${String(displayIndex + 1).padStart(2, "0")} / ${String(frames.length).padStart(2, "0")}`;
        if (previous) {
          window.setTimeout(() => {
            if (previous === frames[paintedScene]) return;
            previous.style.opacity = "0";
            previous.style.visibility = "hidden";
          }, 220);
        }
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
    autoplayActive = false;
    playbackComplete = true;
    playbackPaused = false;
    hasLeftOpening = false;
    stopPendingOpeningLoads();
    openingLoader.hidden = true;
    openingLoader.classList.remove("is-exiting");
    pauseButton.hidden = true;
    openingStatus.textContent = "";
    updateScroll();
    if (navigate) window.requestAnimationFrame(() => firstSection.scrollIntoView({ behavior: "smooth" }));
  }

  function replayOpening() {
    playbackRun += 1;
    autoplayActive = !motionReduced.matches;
    playbackComplete = false;
    playbackPaused = false;
    hasLeftOpening = false;
    autoplayIndex = 0;
    finalMessageReady = false;
    loadsEnabled = true;
    pumpOpeningLoads();
    opening.classList.add("opening--short");
    opening.style.removeProperty("--sequence-height");
    pauseButton.hidden = true;
    pauseButton.textContent = "일시정지";
    openingStatus.textContent = autoplayActive ? "사진 준비 중" : "아래로 스크롤 ↓";
    openingLoader.classList.remove("is-exiting");
    openingLoader.hidden = !autoplayActive || frames.every((frame) => ["ready", "failed"].includes(frame.dataset.status));
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
  }

  document.querySelectorAll('a[href="#opening"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      replayOpening();
    });
  });

  document.querySelector(".skip-link").addEventListener("click", () => {
    if (autoplayActive) finishOpening(false);
  });

  motionReduced.addEventListener("change", () => {
    if (!motionReduced.matches || !autoplayActive) return;
    finishOpening(false);
    openingStatus.textContent = "아래로 스크롤 ↓";
    loadsEnabled = true;
    requestOpeningFrame(0, true);
    updateScroll();
  });

  pauseButton.addEventListener("click", () => {
    playbackPaused = !playbackPaused;
    pauseButton.textContent = playbackPaused ? "이어보기" : "일시정지";
    openingStatus.textContent = playbackPaused ? "일시정지" : "자동 재생 중";
  });
  skipButton.addEventListener("click", () => finishOpening(false));

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
    let settled = 0;
    loaderCount.textContent = `00 / ${String(frames.length).padStart(2, "0")}`;
    loaderProgress.style.width = "0%";
    openingStatus.textContent = `사진 준비 중 ${settled}/${frames.length}`;
    const prepared = frames.map((_, index) =>
      requestOpeningFrame(index, index === 0).then(() => {
        settled += 1;
        if (autoplayActive && run === playbackRun) {
          loaderCount.textContent = `${String(settled).padStart(2, "0")} / ${String(frames.length).padStart(2, "0")}`;
          loaderProgress.style.width = `${settled / frames.length * 100}%`;
          openingStatus.textContent = `사진 준비 중 ${settled}/${frames.length}`;
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
    const middleFrameMs = 360;
    openingStatus.textContent = "자동 재생 중";
    pauseButton.hidden = false;
    for (let index = 0; index < frames.length && autoplayActive && run === playbackRun; index += 1) {
      await waitUntilActive(run);
      if (!autoplayActive || run !== playbackRun) return;
      if (frames[index].dataset.status === "ready") {
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
      await waitPlayback(index === 0 ? 1500 : index === frames.length - 1 ? 1900 : middleFrameMs, run);
    }
    if (run === playbackRun) finishOpening();
  }

  if (autoplayActive) playOpening(++playbackRun);
})();
