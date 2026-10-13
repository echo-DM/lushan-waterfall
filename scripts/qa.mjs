import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:4173';
const session = execFileSync('agent-browser', ['session', 'id', '--scope', 'worktree', '--prefix', 'lushan-qa'], { encoding: 'utf8' }).trim();
const output = resolve('docs/screenshots');
mkdirSync(output, { recursive: true });
const results = [];
const views = ['purple-mist', 'hanging-waterfall', 'plunging-water', 'silver-river'];
let cdp;
let contextPatched = false;
let expectedGraphicsConsole = [];
const accessibility = [];

function browser(...args) {
  const raw = execFileSync('agent-browser', ['--session', session, '--json', ...args], {
    encoding: 'utf8', timeout: 35000, maxBuffer: 3 * 1024 * 1024,
  });
  const response = JSON.parse(raw);
  assert.equal(response.success, true, response.error ?? raw);
  return response.data;
}

function evaluate(source) { return browser('eval', source).result; }
function state() { return evaluate('window.__lushan.state'); }
function wait(condition) { browser('wait', '--fn', condition); }
function screenshot(name, full = false) {
  browser('screenshot', ...(full ? ['--full'] : []), resolve(output, `${name}.png`));
}
function ready() {
  wait('window.__lushan?.state?.ready === true && document.querySelectorAll("canvas").length === 1 && !document.querySelector(".loading-message")');
}
function arrive(id) {
  wait(`window.__lushan?.state?.view === '${id}' && !window.__lushan.state.flying`);
}
function select(id) {
  const selector = id === 'overview' ? '.scene-controls button:first-child' : `#verse-${id}`;
  browser('scrollintoview', selector);
  browser('click', selector);
  arrive(id);
}
function layout() {
  return evaluate(`({
    viewport: [innerWidth, innerHeight],
    overflow: document.documentElement.scrollWidth > innerWidth,
    buttons: [...document.querySelectorAll('.verse-button')].map(button => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height, left: rect.left, right: rect.right };
    }),
    canvasCount: document.querySelectorAll('canvas').length
  })`);
}
function distance(snapshot) {
  return Math.hypot(...snapshot.camera.map((value, index) => value - snapshot.target[index]));
}
function checkAccessibility(size) {
  const report = browser('a11y', '--tags', 'wcag2a,wcag2aa');
  accessibility.push({ size, counts: report.counts, violations: report.violations, incomplete: report.incomplete });
  assert.deepEqual(report.violations, []);
  return report.counts;
}
async function check(name, action) {
  try {
    const detail = await action();
    results.push({ name, passed: true, detail: detail ?? null });
    console.log(`PASS ${name}`);
  } catch (error) {
    let diagnostic;
    try {
      diagnostic = evaluate(`({ state: window.__lushan?.state, status: document.querySelector('.world-wrapper')?.dataset.status,
        selected: document.querySelector('.verse-button[aria-pressed=true]')?.dataset.view,
        scrollY, visibility: document.visibilityState })`);
    } catch {}
    results.push({ name, passed: false, error: String(error), diagnostic });
    console.error(`FAIL ${name}: ${error.message}`);
    if (diagnostic) console.error(JSON.stringify(diagnostic));
    throw error;
  }
}

// agent-browser owns the session. CDP supplies multi-touch, a wheel event with
// explicit canvas coordinates, and controlled failure injection.
async function connectCdp() {
  const { cdpUrl } = browser('get', 'cdp-url');
  const address = new URL(cdpUrl);
  const targets = await (await fetch(`http://${address.host}/json/list`)).json();
  const page = targets.find((target) => target.type === 'page' && target.url.replace(/\/$/, '') === url.replace(/\/$/, ''));
  assert.ok(page, 'The isolated preview page must exist');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    const handlers = pending.get(message.id);
    if (!handlers) return;
    clearTimeout(handlers.timer);
    pending.delete(message.id);
    if (message.error) handlers.reject(new Error(message.error.message));
    else handlers.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      return new Promise((resolveSend, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
        pending.set(id, { resolve: resolveSend, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

function waitForFrames(count = 20) {
  const before = state().frameCount;
  wait(`window.__lushan.state.frameCount > ${before + count}`);
}

try {
  browser('open', url);
  browser('set', 'viewport', '1440', '900');
  ready();
  cdp = await connectCdp();

  await check('desktop first frame, full poem, single canvas', () => {
    assert.equal(evaluate('document.querySelectorAll(".verse-button").length'), 4);
    assert.equal(state().view, 'overview');
    assert.equal(state().flying, false);
    assert.equal(layout().overflow, false);
    screenshot('overview-desktop');
    return state();
  });

  for (const id of views) {
    await check(`desktop viewpoint: ${id}`, () => {
      select(id);
      assert.equal(evaluate(`document.querySelector('#verse-${id}').getAttribute('aria-pressed')`), 'true');
      assert.equal(evaluate('document.querySelectorAll(".verse-button[aria-pressed=true]").length'), 1);
      assert.equal(layout().canvasCount, 1);
      screenshot(`${id}-desktop`);
      return state();
    });
  }

  await check('desktop accessibility: no detected WCAG A/AA violations', () => checkAccessibility('1440 x 900'));

  await check('rapid selection reaches the latest verse', () => {
    for (const id of views) browser('click', `#verse-${id}`);
    arrive('silver-river');
    assert.equal(evaluate('document.querySelector(".verse-button[aria-pressed=true]").dataset.view'), 'silver-river');
    return state();
  });

  await check('leaving an upward view has no immediate camera jump', () => {
    const before = state();
    browser('click', '#verse-purple-mist');
    const next = state();
    assert.equal(next.flying, true);
    assert.ok(Math.hypot(...before.camera.map((value, index) => value - next.camera[index])) < 15);
    arrive('purple-mist');
    return { before: before.camera, after: next.camera };
  });

  await check('drag interrupts an active camera flight', () => {
    browser('click', '#verse-hanging-waterfall');
    browser('mouse', 'move', '440', '370');
    browser('mouse', 'down');
    const interrupted = state();
    assert.equal(interrupted.flying, false);
    browser('mouse', 'move', '510', '390');
    browser('mouse', 'move', '540', '405');
    browser('mouse', 'up');
    waitForFrames();
    const after = state();
    assert.ok(Math.hypot(...after.camera.map((value, index) => value - interrupted.camera[index])) > 2);
    return { interrupted: interrupted.camera, after: after.camera };
  });

  await check('switching view while dragging reaches the requested verse', () => {
    browser('mouse', 'move', '440', '370');
    browser('mouse', 'down');
    browser('mouse', 'move', '470', '385');
    browser('press', '3');
    browser('mouse', 'up');
    arrive('plunging-water');
    return state();
  });

  await check('repeat selection restores a view after free observation', () => {
    select('hanging-waterfall');
    const expected = state();
    browser('mouse', 'move', '440', '370');
    browser('mouse', 'down');
    browser('mouse', 'move', '535', '410');
    browser('mouse', 'up');
    browser('click', '#verse-hanging-waterfall');
    arrive('hanging-waterfall');
    assert.ok(Math.hypot(...state().camera.map((value, index) => value - expected.camera[index])) < 0.01);
  });

  await check('mouse wheel zoom changes camera distance', async () => {
    select('overview');
    const before = distance(state());
    browser('mouse', 'move', '440', '370');
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 440, y: 370, deltaY: -220, deltaX: 0 });
    waitForFrames();
    const after = distance(state());
    assert.ok(after < before - 2, `Zoom distance before=${before}, after=${after}; state=${JSON.stringify(state())}`);
    return { before, after };
  });

  await check('return to overview clears verse selection', () => {
    select('overview');
    assert.equal(evaluate('document.querySelectorAll(".verse-button[aria-pressed=true]").length'), 0);
    return state();
  });

  await check('keyboard navigation and visible focus', () => {
    browser('focus', '#verse-purple-mist');
    browser('press', 'Enter');
    arrive('purple-mist');
    browser('press', 'ArrowDown');
    arrive('hanging-waterfall');
    assert.equal(evaluate('document.activeElement.id'), 'verse-hanging-waterfall');
    browser('press', 'End');
    arrive('silver-river');
    browser('press', '0');
    arrive('overview');
  });

  await check('pause freezes scenery while navigation remains active', () => {
    browser('click', '.scene-controls button:nth-of-type(2)');
    const before = state().animationTime;
    waitForFrames(25);
    assert.equal(state().animationTime, before);
    select('plunging-water');
    assert.equal(state().animationTime, before);
    browser('click', '.scene-controls button:nth-of-type(2)');
    wait(`window.__lushan.state.animationTime > ${before + 0.1}`);
  });

  await check('manual reduced motion freezes scenery and removes flights', () => {
    browser('click', '.motion-button');
    const before = state().animationTime;
    browser('click', '#verse-purple-mist');
    assert.equal(state().flying, false);
    assert.equal(state().view, 'purple-mist');
    waitForFrames();
    assert.equal(state().animationTime, before);
    assert.equal(evaluate('document.querySelector(".scene-controls button:nth-of-type(2)").disabled'), true);
    browser('click', '.motion-button');
    return { frozenAt: before };
  });

  await check('desktop resize preserves scene and readable navigation', () => {
    browser('set', 'viewport', '1280', '800');
    assert.equal(layout().overflow, false);
    assert.equal(layout().canvasCount, 1);
    select('overview');
    screenshot('overview-desktop-1280');
    return layout();
  });

  await check('simulated mobile layout and first frame', () => {
    browser('set', 'device', 'iPhone 15');
    browser('set', 'viewport', '390', '844');
    browser('reload');
    ready();
    assert.equal(state().compact, true);
    assert.equal(layout().overflow, false);
    for (const button of layout().buttons) {
      assert.ok(button.height >= 44 && button.right <= 390);
    }
    screenshot('overview-mobile', true);
    return { ...layout(), state: state() };
  });

  for (const id of views) {
    await check(`simulated mobile viewpoint: ${id}`, () => {
      select(id);
      evaluate('window.scrollTo(0, 0)');
      assert.equal(layout().overflow, false);
      screenshot(`${id}-mobile`, true);
      return state();
    });
  }

  await check('simulated mobile accessibility: no detected WCAG A/AA violations', () => checkAccessibility('390 x 844'));

  await check('simulated single-finger orbit', async () => {
    select('overview');
    evaluate('window.scrollTo(0, 0)');
    const before = state();
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 160, y: 310, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: 317, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 218, y: 333, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    waitForFrames();
    const after = state();
    assert.ok(Math.hypot(...after.camera.map((value, index) => value - before.camera[index])) > 3);
    return { before: before.camera, after: after.camera };
  });

  await check('simulated two-finger pinch zoom', async () => {
    select('overview');
    evaluate('window.scrollTo(0, 0)');
    const before = distance(state());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 160, y: 320, id: 1 }, { x: 210, y: 320, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 145, y: 320, id: 1 }, { x: 225, y: 320, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 125, y: 320, id: 1 }, { x: 245, y: 320, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    waitForFrames();
    const after = distance(state());
    assert.ok(Math.abs(before - after) > 3);
    return { before, after };
  });

  await check('system reduced motion on fresh mount', () => {
    browser('set', 'media', 'light', 'reduced-motion');
    browser('reload');
    ready();
    assert.equal(state().reducedMotion, true);
    const time = state().animationTime;
    select('silver-river');
    assert.equal(state().flying, false);
    waitForFrames();
    assert.equal(state().animationTime, time);
    browser('set', 'media', 'light');
    browser('reload');
    ready();
  });

  await check('normal console and page errors before failure injection', () => {
    const errors = browser('errors').errors ?? [];
    const logs = browser('console').messages ?? [];
    assert.deepEqual(errors, []);
    assert.deepEqual(logs.filter((message) => message.type === 'error' || message.level === 'error'), []);
    return { errors, consoleErrors: [] };
  });

  await check('graphics connection loss preserves poem and can recover', () => {
    evaluate(`document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()`);
    wait('document.querySelector(".world-wrapper").dataset.status === "error"');
    assert.equal(state().ready, false);
    assert.equal(state().contextLost, true);
    assert.equal(evaluate('document.querySelectorAll(".verse-button").length'), 4);
    screenshot('graphics-recovery-mobile', true);
    browser('click', '.restore-button');
    ready();
    assert.equal(state().contextLost, false);
    assert.equal(layout().canvasCount, 1);
  });

  await check('WebGL unavailable during scene initialization preserves poem', () => {
    evaluate(`document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()`);
    wait('document.querySelector(".world-wrapper")?.dataset.status === "error"');
    evaluate(`window.__qaOriginalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null;
        return window.__qaOriginalGetContext.call(this, type, ...args);
      };`);
    contextPatched = true;
    browser('click', '.restore-button');
    wait('document.querySelector(".world-wrapper")?.dataset.status === "error" && window.__lushan?.state === null');
    assert.equal(evaluate('document.querySelectorAll(".verse-button").length'), 4);
    assert.equal(evaluate('document.querySelector("h1").textContent'), '望庐山瀑布');
    screenshot('webgl-unavailable-mobile', true);
    expectedGraphicsConsole = browser('console').messages ?? [];
    assert.deepEqual(browser('errors').errors, []);
    for (const message of expectedGraphicsConsole) {
      if (message.type === 'error' || message.level === 'error') {
        assert.match(JSON.stringify(message), /Error creating WebGL context/);
      }
    }
    browser('console', '--clear');
    evaluate('HTMLCanvasElement.prototype.getContext = window.__qaOriginalGetContext; delete window.__qaOriginalGetContext;');
    contextPatched = false;
    browser('click', '.restore-button');
    ready();
  });

  await check('recovery remounts leave one canvas and responsive navigation', () => {
    select('hanging-waterfall');
    select('overview');
    assert.equal(layout().canvasCount, 1);
    assert.equal(state().ready, true);
    return state();
  });

  await check('final production console and page errors', () => {
    const errors = browser('errors').errors ?? [];
    const consoleMessages = browser('console').messages ?? [];
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleMessages.filter((message) => message.type === 'error' || message.level === 'error'), []);
    return { errors, consoleMessages };
  });
} finally {
  if (contextPatched) {
    try { evaluate('HTMLCanvasElement.prototype.getContext = window.__qaOriginalGetContext; delete window.__qaOriginalGetContext;'); } catch {}
  }
  cdp?.close();
  writeFileSync(resolve('docs/qa-results.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), url, browser: 'agent-browser isolated Chromium',
    mobile: '390 x 844; iPhone 15 emulation with viewport override; CDP touch input, not a physical device',
    expectedGraphicsConsole, passed: results.length > 0 && results.every((result) => result.passed), checks: results,
  }, null, 2) + '\n');
  writeFileSync(resolve('docs/accessibility-results.json'), JSON.stringify(accessibility, null, 2) + '\n');
  try { browser('close'); } catch {}
}
console.log(`Completed ${results.length} browser checks.`);
