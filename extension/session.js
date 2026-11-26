export const roomUrl = "https://live.bilibili.com/22637261";

export function isDianaRoom(url, target = roomUrl) {
  const page = new URL(url);
  return page.origin + page.pathname.replace(/\/$/, "") === target;
}

// Chrome copies this function into the tab's isolated world without its imports.
export function controlSession(action, count, roomUrl) {
  const state = globalThis.dianaLiveLike ??= { phase: "idle", clicks: 0, total: 0 };
  const inRoom = () => location.origin + location.pathname.replace(/\/$/, "") === roomUrl;
  const snapshot = () => ({ phase: state.phase, clicks: state.clicks, total: state.total });

  if (!inRoom()) {
    state.stop?.("wrong-room");
    return { ...snapshot(), phase: "wrong-room" };
  }

  if (action === "stop") {
    state.stop?.("stopped");
    return snapshot();
  }

  if (action !== "start" || state.stop) return snapshot();
  if (!Number.isInteger(count) || count < 1 || count > 30) {
    return { ...snapshot(), phase: "invalid-count" };
  }

  const clickInterval = 3_000;
  const loadDeadline = Date.now() + 15_000;
  const selector = '#control-panel-ctnr-box .like-btn[data-event-name="dianzan.0.show"]';
  let timer;

  function finish(phase) {
    clearTimeout(timer);
    window.removeEventListener("pagehide", onPageHide);
    state.phase = phase;
    state.stop = null;
  }

  function onPageHide() {
    finish("stopped");
  }

  function tick() {
    if (!inRoom()) {
      finish("wrong-room");
      return;
    }

    const [button, another] = document.querySelectorAll(selector);
    const available = button instanceof HTMLElement
      && !another
      && button.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      && !button.closest('[inert], [disabled], [aria-disabled="true"]')
      && getComputedStyle(button).pointerEvents !== "none";

    if (!available) {
      if (state.clicks === 0 && Date.now() < loadDeadline) {
        timer = setTimeout(tick, 300);
      } else {
        finish("unavailable");
      }
      return;
    }

    state.phase = "running";
    button.click();
    if (!state.stop) return;

    state.clicks += 1;
    if (state.clicks === state.total) {
      finish("complete");
    } else {
      timer = setTimeout(tick, clickInterval);
    }
  }

  Object.assign(state, { phase: "waiting", clicks: 0, total: count, stop: finish });
  window.addEventListener("pagehide", onPageHide);
  tick();
  return snapshot();
}
