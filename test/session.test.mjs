import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { controlSession, isDianaRoom, roomUrl } from "../extension/session.js";

function fixture({ showButton = true, showPanel = showButton } = {}) {
  let now = 0;
  let nextTimer = 0;
  let buttons = [];
  const timers = new Map();
  const clickTimes = [];
  const window = new EventTarget();
  const location = new URL(roomUrl);

  class LikeButton {
    visible = true;
    disabled = false;

    checkVisibility() { return this.visible; }
    closest() { return this.disabled ? this : null; }
    click() { clickTimes.push(now); }
  }

  const button = new LikeButton();
  if (showButton) buttons = [button];

  const call = runInNewContext(`(${controlSession})`, {
    location,
    window,
    HTMLElement: LikeButton,
    Date: { now: () => now },
    document: {
      readyState: "complete",
      querySelector(selector) {
        assert.equal(selector, "#control-panel-ctnr-box");
        return showPanel ? {} : null;
      },
      querySelectorAll(selector) {
        assert.equal(selector, '#control-panel-ctnr-box .like-btn[data-event-name="dianzan.0.show"]');
        return buttons;
      }
    },
    getComputedStyle: () => ({ pointerEvents: "auto" }),
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout: id => timers.delete(id)
  });

  function advance(ms) {
    const end = now + ms;
    while (timers.size) {
      const [id, timer] = timers.entries().next().value;
      if (timer.at > end) break;
      now = timer.at;
      timers.delete(id);
      timer.callback();
    }
    now = end;
  }

  return {
    button,
    clickTimes,
    location,
    window,
    advance,
    control: (action, count) => ({ ...call(action, count, roomUrl) }),
    show: () => { buttons = [button]; },
    showTwo: () => { buttons = [button, new LikeButton()]; }
  };
}

test("房间识别允许分享参数，并拒绝其他源和路径", () => {
  assert.equal(isDianaRoom(roomUrl + "/?spm_id_from=share#player"), true);
  assert.equal(isDianaRoom(roomUrl + "0"), false);
  assert.equal(isDianaRoom("https://bilibili.example/22637261"), false);
  assert.equal(isDianaRoom("http://live.bilibili.com/22637261"), false);
});

test("查询状态和不合法的次数都不会触发点赞", () => {
  const page = fixture();
  assert.equal(page.control("status").phase, "idle");
  for (const count of [0, 31, 1.5, "5"]) {
    assert.equal(page.control("start", count).phase, "invalid-count");
  }
  page.advance(15_000);
  assert.deepEqual(page.clickTimes, []);
});

test("授权后立即首击，并按设定次数和间隔运行", () => {
  const page = fixture();
  assert.deepEqual(page.control("start", 3), { phase: "running", clicks: 1, total: 3 });
  assert.equal(page.control("start", 5).total, 3);
  page.advance(15_000);
  assert.deepEqual(page.clickTimes, [0, 3_000, 6_000]);
  assert.equal(page.control("status").phase, "complete");
});

test("可以停止后续点击，重新授权后可开始新一轮", () => {
  const page = fixture();
  page.control("start", 5);
  assert.equal(page.control("stop").phase, "stopped");
  page.advance(9_000);
  assert.deepEqual(page.clickTimes, [0]);
  assert.equal(page.control("start", 1).phase, "complete");
  assert.deepEqual(page.clickTimes, [0, 9_000]);
});

test("按钮延迟出现时等待，出现后自动首击", () => {
  const page = fixture({ showButton: false });
  assert.equal(page.control("start", 1).phase, "waiting");
  page.advance(900);
  page.show();
  page.advance(300);
  assert.deepEqual(page.clickTimes, [1_200]);
});

test("按钮有歧义时报告结构变化，且不会点击", () => {
  const page = fixture();
  page.showTwo();
  page.control("start", 3);
  page.advance(15_000);
  assert.equal(page.control("status").phase, "button-structure");
  assert.deepEqual(page.clickTimes, []);
});

test("区分未加载的控件与已加载但缺少点赞按钮的控件", () => {
  for (const [showPanel, expected] of [[false, "room-loading"], [true, "button-structure"]]) {
    const page = fixture({ showButton: false, showPanel });
    assert.equal(page.control("start", 3).phase, "waiting");
    page.advance(15_000);
    assert.deepEqual(page.control("status"), { phase: expected, clicks: 0, total: 3 });
    assert.deepEqual(page.clickTimes, []);
  }
});

test("按钮不可用时停止已有轮次", () => {
  const page = fixture();
  page.control("start", 3);
  page.button.disabled = true;
  page.advance(3_000);
  assert.equal(page.control("status").phase, "button-unavailable");
  assert.deepEqual(page.clickTimes, [0]);
});

test("切换到其他直播间会停止待执行的点击", () => {
  const page = fixture();
  page.control("start", 5);
  page.location.pathname = "/123";
  page.advance(3_000);
  assert.equal(page.control("start", 5).phase, "wrong-room");
  assert.deepEqual(page.clickTimes, [0]);
});

test("页面离开时停止等待，返回页面后需要重新授权", () => {
  const page = fixture({ showButton: false });
  page.control("start", 5);
  page.window.dispatchEvent(new Event("pagehide"));
  page.show();
  page.advance(30_000);
  assert.equal(page.control("status").phase, "stopped");
  assert.deepEqual(page.clickTimes, []);
});
