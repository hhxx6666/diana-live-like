import { controlSession, isDianaRoom, roomUrl } from "./session.js";

const form = document.querySelector("form");
const count = document.querySelector("#count");
const start = document.querySelector("#start");
const stop = document.querySelector("#stop");
const status = document.querySelector("#status");
let tabId;
let busy = false;
let requestId = 0;
let refreshTimer;

function render({ phase, clicks = 0, total = 0 }) {
  const active = phase === "waiting" || phase === "running";
  const canStart = !active && phase !== "wrong-room";
  const progress = `${clicks}/${total}`;
  const messages = {
    idle: "请先在 B 站登录，再授权本轮点赞。",
    waiting: "正在等待直播间显示点赞按钮…",
    running: `已触发 ${progress} 次。`,
    complete: `本轮结束，已触发 ${progress} 次。实际点赞以 B 站显示为准。`,
    stopped: `本轮已停止。已触发 ${progress} 次。如需继续，请重新授权。`,
    "room-loading": `直播间控件尚未加载，本轮已停止（${progress}）。请等页面加载后重试。`,
    "button-structure": `无法识别唯一的点赞按钮，页面结构可能已变化。本轮已停止（${progress}）。`,
    "button-unavailable": `点赞按钮当前不可用，本轮已停止（${progress}）。请检查页面和登录状态。`,
    "invalid-count": "请输入 1 到 30 之间的整数。",
    "wrong-room": "请进入嘉然直播间，再打开扩展。",
    error: "暂时无法读取页面。刷新直播间后可重试。"
  };
  count.disabled = !canStart || busy;
  start.disabled = !canStart || busy;
  start.hidden = active;
  stop.disabled = busy;
  stop.hidden = !active;
  if (active) count.valueAsNumber = total;
  if (status.textContent !== messages[phase]) status.textContent = messages[phase];

  clearTimeout(refreshTimer);
  if (active) refreshTimer = setTimeout(() => request("status"), 500);
}

async function request(action, requestedCount = null) {
  if (busy) return;
  const id = ++requestId;
  if (action !== "status") {
    busy = true;
    start.disabled = true;
    stop.disabled = true;
  }

  let state;
  try {
    const [frame] = await chrome.scripting.executeScript({
      target: { tabId },
      func: controlSession,
      args: [action, requestedCount, roomUrl]
    });
    state = frame?.result ?? { phase: "error" };
  } catch {
    state = { phase: "error" };
  }

  if (action !== "status") busy = false;
  if (id === requestId) render(state);
}

form.addEventListener("submit", event => {
  event.preventDefault();
  if (form.reportValidity()) void request("start", count.valueAsNumber);
});
stop.addEventListener("click", () => void request("stop"));

try {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null && tab.url && isDianaRoom(tab.url)) {
    tabId = tab.id;
    await request("status");
  } else {
    render({ phase: "wrong-room" });
  }
} catch {
  render({ phase: "wrong-room" });
}
