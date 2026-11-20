// ==PocketCore==
// @name         Zeta 화면 보정 + 도구 주머니
// @namespace    zeta-screen-kit
// @version      1.1.58
// @description  제타 화면·키보드를 보정하고 플로팅 도구와 직접 저장한 북마클릿을 주머니에 담습니다.
// @match        https://zeta-ai.io/ko
// @match        https://zeta-ai.io/ko/*
// @run-at       document-start
// @weight       999
// @inject-into  page
// @grant        unsafeWindow
// ==/PocketCore==

(() => {
  'use strict';

  const w = window;
  const d = document;
  const VERSION = '1.1.58';
  const INSTANCE_KEY = '__ZETA_FULLSCREEN_TOOL_POCKET__';
  const RUNTIME_UPDATE_KEY = '__ZETA_SCREEN_KIT_ALL_UPDATE__';
  const RUNTIME_SOURCE_URL = 'https://zetdal-screen-kit.netlify.app/all.js';
  const STYLE_ID = 'zeta-fullscreen-pocket-page-style';
  const THEME_META_ID = 'zeta-fullscreen-pocket-theme-color';
  const HOST_ID = 'zeta-tool-pocket';
  const POSITION_KEY = 'zeta-tool-pocket-position-v1';
  const PANEL_POSITION_KEY = 'zeta-tool-pocket-panel-position-v1';
  const SELECTION_KEY = 'zeta-tool-pocket-selected-v1';
  const CUSTOM_KEY = 'zeta-tool-pocket-custom-v1';
  const FINGERPRINT_KEY = 'zeta-tool-pocket-captured-fingerprints-v1';
  const BOOKMARKLETS_KEY = 'zeta-tool-pocket-bookmarklets-v1';
  const BOOKMARKLETS_DB_NAME = 'zeta-tool-pocket-db';
  const BOOKMARKLETS_DB_VERSION = 1;
  const BOOKMARKLETS_STORE = 'pocket-data';
  const BOOKMARKLETS_RECORD_KEY = 'bookmarklets-v1';
  const BOOKMARKLETS_CACHE_GLOBAL = '__ZETA_POCKET_BOOKMARKLETS_CACHE_V1__';
  const BOOKMARKLET_LAUNCHER_ATTR = 'data-zeta-pocket-bookmarklet-launcher';
  const MANAGED_ATTR = 'data-zeta-pocket-original';
  const HIDE_STYLE_ATTR = 'data-zeta-pocket-hide-style';
  const BRIDGE_TOOLS_ATTR = 'data-zeta-pocket-shadow-tools';
  const BRIDGE_ID_ATTR = 'data-zeta-pocket-shadow-id';
  const BRIDGE_INFO_EVENT = '__ZETA_POCKET_SHADOW_INFO_V1__';
  const BRIDGE_ACTION_EVENT = '__ZETA_POCKET_SHADOW_ACTION_V1__';
  const PAGE_BRIDGE_GLOBAL = '__ZETA_POCKET_PAGE_SHADOW_BRIDGE_V2__';
  const SHADOW_CAPTURE_GLOBAL = '__ZETA_POCKET_CAPTURED_SHADOW_ROOTS_V1__';
  const EXTERNAL_TOOL_ROOT_SELECTOR = '#zetaKitRootV5,#zk-memory-panel,#zk_review_panel,#zk_review_quick_panel,#zk_review_history_panel,#zetakit-lore-host,[data-zeta-screen-ignore]';
  const LONG_PRESS_MS = 540;
  const CHAT_INPUT = 'textarea[name="message"],textarea[testid="chat-message-input"],textarea[data-testid="chat-message-input"]';
  const REVIEW_LABELS = ['검토', '새답변', '추천', '무응답', '퀵', '이력', '로어', '설정'];
  const TOOL_CONTROL_SELECTOR = 'button,[role="button"],a,input[type="button"],input[type="submit"]';
  const AUTO_KILLER_TOOLS = [
    { key: 'review', label: '검토', icon: '🔎', matches: text => text === '검토' },
    { key: 'generate', label: '생성', icon: '✨', matches: text => text === '생성' },
    { key: 'summary', label: '요약', icon: '📝', matches: text => text === '요약' },
    { key: 'settings', label: '설정', icon: '⚙️', matches: text => text === '설정' },
    { key: 'autosave', label: '자동 저장', icon: '💾', matches: text => /^저장\s+(?:ON|OFF)$/i.test(text) },
  ];
  const TOOL_NODE_SELECTOR = '#zeta-screen-fit-control,#zeta-persona-editor-host,#zpc-userscript-launcher,#zeta-chat-summary-float-button,#zeta-visible-join-button,#zk-memory-fab,#zeta-shell-api-export-button,#zk_memo_dock,#zk-chat-games-root,[data-zeta-review-tabbar-drag="true"],[data-inpocket],[data-zeta-pocket-shadow-tools],[role="toolbar"],[id^="zk-"],[id*="zetakit"],[id*="inpocket"],[id*="zeta-"][id*="launcher"],[id*="toolbar"],[id*="tool-bar"],[id*="tabbar"],[id*="dock"],[class*="inpocket"],[class*="toolbar"],[class*="tool-bar"],[class*="tabbar"],[class*="dock"]';
  const disposers = [];
  const actions = new Map();
  const candidates = new Map();
  const elementActions = new Map();
  const groupedToolbarElements = new WeakSet();
  const candidateDragRoots = new WeakSet();
  const toolRootObservers = new Map();
  // 원격 본체가 자동 교체되어도 이미 잡은 closed ShadowRoot를 잃지 않는다.
  const capturedShadowRoots = w[SHADOW_CAPTURE_GLOBAL] instanceof WeakMap
    ? w[SHADOW_CAPTURE_GLOBAL]
    : (w[SHADOW_CAPTURE_GLOBAL] = new WeakMap());
  const hiddenTargets = new Map();
  const temporarilyVisibleTargets = new WeakSet();
  const handoffOriginals = new Map();
  const bookmarkletRuntimes = new Map();
  const editSavedStyles = new Map();
  let mutationObserver = null;
  let scanTimer = 0;
  let scanFrame = 0;
  let scanInterval = 0;
  let editFrame = 0;
  let editActive = false;
  let editSheet = null;
  let editTypingFrame = 0;
  let editTypingTimers = [];
  let editTypingLock = null;
  let editCaretGuardUntil = 0;
  let viewportFrame = 0;
  let viewportKeepInput = false;
  let lastThemeSync = 0;
  let keyboardBaselineWidth = 0;
  let keyboardBaselineHeight = 0;
  let externalViewportHoldUntil = 0;
  let externalViewportResumeTimer = 0;
  let pocket = null;
  let candidateDrag = null;
  let originalAttachShadow = null;
  let pocketAttachShadow = null;
  let pageBridgeRetryQueued = false;
  let forwardedPointerSerial = 100000;
  let lastPointerDragAt = 0;
  let bookmarkletStorageMode = 'loading';
  let bookmarkletStorageReady = null;
  let bookmarkletWriteQueue = Promise.resolve();
  const forwardedPointerIDs = new Set();
  const selectedIDs = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SELECTION_KEY) || '[]');
      return new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch (_) { return new Set(); }
  })();
  const customizations = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch (_) { return {}; }
  })();
  // Persist a stable launcher fingerprint alongside the selected action ID.
  // Dynamic button labels and generated element positions must not affect it.
  const capturedFingerprints = (() => {
    try {
      const value = JSON.parse(localStorage.getItem(FINGERPRINT_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  })();
  function launcherFingerprint(element) {
    if (!(element instanceof HTMLElement)) return '';
    const root = element.getRootNode?.();
    const host = root instanceof ShadowRoot ? root.host : null;
    const carrier = visualCarrierForElement(element);
    const stable = node => {
      if (!(node instanceof HTMLElement)) return '';
      const id = node.id;
      if (id && !/^[0-9a-f]{8,}$/i.test(id) && !/\d{6,}/.test(id)) return '#'+id;
      for (const key of ['data-testid','data-tool-name','data-action','data-inpocket']) {
        const v=node.getAttribute(key);
        if(v && v.length<90)return key+'='+v;
      }
      const cls=[...node.classList].filter(v=>/^[a-z][\w-]{3,}$/i.test(v)&&!/(active|open|close|drag|hover|selected|visible|hidden|fixed|absolute|left|right|top|bottom|css-|sc-)/i.test(v));
      return cls.length ? node.tagName.toLowerCase()+'.'+cls.slice(0,2).join('.') : '';
    };
    const parts=[stable(host),stable(carrier),stable(element)].filter(Boolean);
    // Do not persist weak fingerprints shared by generic anonymous buttons.
    if (!parts.length || parts.every(v=>/^(div|button|span)$/.test(v)))return '';
    return parts.join('|');
  }
  function rememberCapturedCandidate(candidate) {
    const fingerprint=launcherFingerprint(candidate?.element);
    if (!fingerprint || !selectedIDs.has(candidate.id)) return;
    capturedFingerprints[fingerprint]=String(candidate.id);
    try {localStorage.setItem(FINGERPRINT_KEY,JSON.stringify(capturedFingerprints))}catch(_){}
  }
  function savedIDForLauncher(element) {
    const fingerprint=launcherFingerprint(element);
    const id=fingerprint && capturedFingerprints[fingerprint];
    return id && selectedIDs.has(String(id)) ? String(id) : '';
  }

  let savedBookmarklets = (() => {
    const cached = w[BOOKMARKLETS_CACHE_GLOBAL];
    if (Array.isArray(cached)) return cached.filter(item => item?.id && item?.code).map(item => ({ ...item }));
    try {
      const saved = JSON.parse(localStorage.getItem(BOOKMARKLETS_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter(item => item?.id && item?.code) : [];
    } catch (_) { return []; }
  })();

  if (false && [...selectedIDs].some(id => id.startsWith('opaque:'))) {
    [...selectedIDs].filter(id => id.startsWith('opaque:')).forEach(id => selectedIDs.delete(id));
    try { localStorage.setItem(SELECTION_KEY, JSON.stringify([...selectedIDs])); } catch (_) {}
  }

  const previousInstance = w[INSTANCE_KEY];
  if (previousInstance?.destroy) {
    const managed = [];
    const visit = root => root?.querySelectorAll?.('*').forEach(element => {
      if (element.getAttribute?.(MANAGED_ATTR) === '1') managed.push(element);
      if (element.shadowRoot) visit(element.shadowRoot);
    });
    visit(d);
    try { previousInstance.destroy(); } catch (_) {}
    managed.forEach(element => {
      if (!(element instanceof HTMLElement) || !element.isConnected) return;
      handoffOriginals.set(element, {
        filter: element.style.getPropertyValue('filter'),
        filterPriority: element.style.getPropertyPriority('filter'),
        opacity: element.style.getPropertyValue('opacity'),
        opacityPriority: element.style.getPropertyPriority('opacity'),
        visibility: element.style.getPropertyValue('visibility'),
        visibilityPriority: element.style.getPropertyPriority('visibility'),
        pointerEvents: element.style.getPropertyValue('pointer-events'),
        pointerPriority: element.style.getPropertyPriority('pointer-events'),
        inert: element.hasAttribute('inert'),
      });
      element.setAttribute(MANAGED_ATTR, '1');
      element.setAttribute('inert', '');
      element.style.setProperty('opacity', '0', 'important');
      element.style.setProperty('visibility', 'hidden', 'important');
      element.style.setProperty('pointer-events', 'none', 'important');
    });
  }
  try { w.__ZETA_SCREEN_KEYBOARD_FIX__?.destroy?.(); } catch (_) {}
  try { w.__ZETA_TOOL_POCKET_ONLY__?.destroy?.(); } catch (_) {}
  installPageShadowBridge();
  installShadowCapture();

  const on = (target, type, handler, options) => {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  };

  function compareVersions(left, right) {
    const a = String(left || '0').split('.').map(value => Number.parseInt(value, 10) || 0);
    const b = String(right || '0').split('.').map(value => Number.parseInt(value, 10) || 0);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
    }
    return 0;
  }

  function checkRuntimeUpdate() {
    const state = w[RUNTIME_UPDATE_KEY] || (w[RUNTIME_UPDATE_KEY] = { loading: null, appliedVersion: '' });
    if (state.loading || compareVersions(state.appliedVersion, VERSION) >= 0) return;
    state.loading = fetch(`${RUNTIME_SOURCE_URL}?runtime=${Date.now()}`, { cache: 'no-store', credentials: 'omit' })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(source => {
        const remoteVersion = source.match(/^\/\/\s*@version\s+([^\s]+)/m)?.[1] || '';
        state.loading = null;
        if (!remoteVersion || compareVersions(remoteVersion, VERSION) <= 0) return;
        state.appliedVersion = remoteVersion;
        const execute = new Function(`${source}\n//# sourceURL=${RUNTIME_SOURCE_URL}`);
        execute.call(w);
      })
      .catch(error => {
        state.loading = null;
        console.warn('[Zeta Screen Kit] 최신 실행본 확인에 실패해 내장 버전을 사용합니다.', error);
      });
  }

  function installShadowCapture() {
    const prototype = w.Element?.prototype;
    if (!prototype || typeof prototype.attachShadow !== 'function') return;
    originalAttachShadow = prototype.attachShadow;
    pocketAttachShadow = function attachShadow(init) {
      const root = Reflect.apply(originalAttachShadow, this, [init]);
      capturedShadowRoots.set(this, root);
      if (this.id !== HOST_ID) w.setTimeout(() => {
        if (!this.isConnected) return;
        watchCandidateDragRoot(root);
        watchToolRoot(root);
        queueScan([], true);
      }, 0);
      return root;
    };
    try { prototype.attachShadow = pocketAttachShadow; }
    catch (_) { originalAttachShadow = pocketAttachShadow = null; }
  }

  function installPageShadowBridge() {
    const mount = d.documentElement || d.head;
    if (!mount) {
      if (pageBridgeRetryQueued) return;
      pageBridgeRetryQueued = true;
      const retry = () => {
        pageBridgeRetryQueued = false;
        installPageShadowBridge();
      };
      d.addEventListener('readystatechange', retry, { once: true });
      w.setTimeout(retry, 0);
      return;
    }
    const script = d.createElement('script');
    script.textContent = `(() => {
      'use strict';
      const GLOBAL = ${JSON.stringify(PAGE_BRIDGE_GLOBAL)};
      const TOOLS_ATTR = ${JSON.stringify(BRIDGE_TOOLS_ATTR)};
      const ID_ATTR = ${JSON.stringify(BRIDGE_ID_ATTR)};
      const INFO_EVENT = ${JSON.stringify(BRIDGE_INFO_EVENT)};
      const ACTION_EVENT = ${JSON.stringify(BRIDGE_ACTION_EVENT)};
      const POCKET_HOST_ID = ${JSON.stringify(HOST_ID)};
      if (window[GLOBAL]) return;
      const roots = new WeakMap();
      let serial = 0;
      const clean = value => String(value || '').replace(/\\s+/g, ' ').trim();
      const stableHostID = host => {
        const source = clean(
          host?.id || host?.getAttribute?.('data-testid') ||
          host?.getAttribute?.('data-name') || host?.getAttribute?.('aria-label')
        ).toLowerCase().replace(/[^0-9a-z가-힣_-]+/g, '-').replace(/^-|-$/g, '');
        return source ? 'host:' + source : '';
      };
      const nameOf = element => clean(
        element?.getAttribute?.('aria-label') || element?.getAttribute?.('title') ||
        element?.getAttribute?.('data-label') || element?.getAttribute?.('data-name') ||
        element?.textContent || element?.value || element?.getAttribute?.('data-action') ||
        element?.getAttribute?.('data-view') || element?.getAttribute?.('data-testid') || element?.id
      );
      const keyOf = (button, index) => clean(
        button.getAttribute('data-action') || button.getAttribute('data-view') ||
        button.getAttribute('data-testid') || button.getAttribute('aria-label') ||
        button.getAttribute('title') || button.id || String(index)
      );
      const stateOf = button => ({
        pressed: button.getAttribute('aria-pressed'),
        checked: button.getAttribute('aria-checked'),
        state: button.getAttribute('data-state') || button.getAttribute('data-status'),
        phase: button.getAttribute('data-phase'),
        title: button.getAttribute('title'),
        label: button.getAttribute('aria-label'),
        text: clean(button.textContent),
        className: typeof button.className === 'string' ? button.className : ''
      });
      const visibleControl = button => {
        if (!button?.isConnected) return false;
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return rect.width > 0 && rect.height > 0 &&
          style.display !== 'none' && style.visibility !== 'hidden';
      };
      const buttonsOf = root => [...root.querySelectorAll('button,[role="button"],a,input[type="button"],input[type="submit"]')]
        .filter(button => !button.disabled && nameOf(button) && visibleControl(button));
      const labelOf = (host, root, buttons) => {
        const named = root.querySelector('[role="toolbar"][aria-label],[data-label],[data-name]');
        const heading = root.querySelector('.head,.header,[class*="title"],h1,h2,h3,strong');
        return nameOf(named) || nameOf(heading) || nameOf(host) || clean(host.id) ||
          (buttons.length > 1 ? nameOf(buttons[0]) + ' 외 ' + (buttons.length - 1) + '개' : nameOf(buttons[0])) || '도구';
      };
      const publish = (host, root) => {
        if (!host?.isConnected) return;
        const buttons = buttonsOf(root);
        if (!buttons.length) return;
        const stableID = stableHostID(host);
        if (stableID && host.getAttribute(ID_ATTR) !== stableID) host.setAttribute(ID_ATTR, stableID);
        else if (!host.hasAttribute(ID_ATTR)) host.setAttribute(ID_ATTR, 'shadow-' + (++serial));
        const value = JSON.stringify({
          label: labelOf(host, root, buttons),
          tools: buttons.map((button, index) => ({ key: keyOf(button, index), label: nameOf(button), index, status: stateOf(button) }))
        });
        if (host.getAttribute(TOOLS_ATTR) !== value) {
          host.setAttribute(TOOLS_ATTR, value);
          document.dispatchEvent(new CustomEvent(INFO_EVENT));
        }
      };
      const watch = (host, root) => {
        roots.set(host, root);
        const refresh = () => publish(host, root);
        new MutationObserver(refresh).observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
        queueMicrotask(refresh);
      };
      const emitPress = (target, phase, request) => {
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const clientX = Number.isFinite(request.clientX) ? request.clientX : rect.left + rect.width / 2;
        const clientY = Number.isFinite(request.clientY) ? request.clientY : rect.top + rect.height / 2;
        const pointerId = Number(request.pointerId) || 1;
        const pointerType = request.pointerType === 'mouse' ? 'mouse' : 'touch';
        const down = phase === 'down';
        const cancelled = phase === 'cancel';
        const pointerName = down ? 'pointerdown' : cancelled ? 'pointercancel' : 'pointerup';
        const options = { bubbles: true, cancelable: true, composed: true, clientX, clientY, pointerId, pointerType, isPrimary: true, button: 0, buttons: down ? 1 : 0 };
        try { target.dispatchEvent(new PointerEvent(pointerName, options)); }
        catch (_) {}
        if (pointerType === 'mouse') {
          try { target.dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', options)); } catch (_) {}
          return;
        }
        try {
          const touch = typeof Touch === 'function'
            ? new Touch({ identifier: pointerId, target, clientX, clientY, screenX: clientX, screenY: clientY, pageX: clientX, pageY: clientY })
            : { identifier: pointerId, target, clientX, clientY, screenX: clientX, screenY: clientY, pageX: clientX, pageY: clientY };
          const touches = down ? [touch] : [];
          const event = typeof TouchEvent === 'function'
            ? new TouchEvent(down ? 'touchstart' : 'touchend', { bubbles: true, cancelable: true, composed: true, touches, targetTouches: touches, changedTouches: [touch] })
            : new Event(down ? 'touchstart' : 'touchend', { bubbles: true, cancelable: true, composed: true });
          target.dispatchEvent(event);
        } catch (_) {}
      };
      const prototype = Element.prototype;
      const original = prototype.attachShadow;
      const wrapped = function(init) {
        const root = Reflect.apply(original, this, [init]);
        if (this.id !== POCKET_HOST_ID) watch(this, root);
        return root;
      };
      try { prototype.attachShadow = wrapped; } catch (_) {}
      document.addEventListener(ACTION_EVENT, event => {
        const host = event.target instanceof Element ? event.target.closest('[' + ID_ATTR + ']') : null;
        const root = host ? roots.get(host) : null;
        if (!root) return;
        let request = {};
        try { request = JSON.parse(String(event.detail || '{}')); } catch (_) {}
        const buttons = buttonsOf(root);
        const target = buttons.find((button, index) => keyOf(button, index) === request.key) || buttons[Number(request.index)];
        if (!target) return;
        if (request.phase === 'down' || request.phase === 'up' || request.phase === 'cancel') emitPress(target, request.phase, request);
        else target.click?.();
      }, true);
      window[GLOBAL] = { roots, publish };
    })();`;
    let installedDirectly = false;
    try {
      const pageWindow = typeof unsafeWindow === 'object' && unsafeWindow ? unsafeWindow : null;
      if (pageWindow && typeof pageWindow.Function === 'function') {
        pageWindow.Function(script.textContent).call(pageWindow);
        installedDirectly = Boolean(pageWindow[PAGE_BRIDGE_GLOBAL]);
      }
    } catch (_) {}
    if (!installedDirectly) {
      const nonceSource = d.querySelector('script[nonce],style[nonce]');
      const nonce = nonceSource?.nonce || nonceSource?.getAttribute?.('nonce') || '';
      if (nonce) script.setAttribute('nonce', nonce);
      try { mount.appendChild(script); } catch (_) {}
    }
    script.remove();
  }

  function shadowRootOf(element) {
    return element?.shadowRoot || capturedShadowRoots.get(element) || null;
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
  const visible = (element) => {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };

  function resolvePressTarget(item) {
    try {
      const target = typeof item?.pressTarget === 'function' ? item.pressTarget() : item?.element;
      return target instanceof Element && target.isConnected ? target : null;
    } catch (_) { return null; }
  }

  function emitOriginalPress(target, phase, sourceEvent) {
    if (!(target instanceof Element) || !target.isConnected) return false;
    const rect = target.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const pointerId = Number(sourceEvent?.pointerId) || 1;
    const pointerType = sourceEvent?.pointerType === 'mouse' ? 'mouse' : 'touch';
    const down = phase === 'down';
    const cancelled = phase === 'cancel';
    const pointerName = down ? 'pointerdown' : cancelled ? 'pointercancel' : 'pointerup';
    const options = { bubbles: true, cancelable: true, composed: true, view: w, clientX, clientY, pointerId, pointerType, isPrimary: true, button: 0, buttons: down ? 1 : 0 };
    try { target.dispatchEvent(new PointerEvent(pointerName, options)); }
    catch (_) {}
    if (pointerType === 'mouse') {
      try { target.dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', options)); } catch (_) {}
      return true;
    }
    try {
      const touch = typeof w.Touch === 'function'
        ? new w.Touch({ identifier: pointerId, target, clientX, clientY, screenX: clientX, screenY: clientY, pageX: clientX, pageY: clientY })
        : { identifier: pointerId, target, clientX, clientY, screenX: clientX, screenY: clientY, pageX: clientX, pageY: clientY };
      const touches = down ? [touch] : [];
      const event = typeof w.TouchEvent === 'function'
        ? new w.TouchEvent(down ? 'touchstart' : 'touchend', { bubbles: true, cancelable: true, composed: true, touches, targetTouches: touches, changedTouches: [touch] })
        : new Event(down ? 'touchstart' : 'touchend', { bubbles: true, cancelable: true, composed: true });
      target.dispatchEvent(event);
    } catch (_) {}
    return true;
  }

  function beginForwardedPress(item, sourceEvent) {
    forwardedPointerSerial += 1;
    const forwardedEvent = {
      pointerId: forwardedPointerSerial,
      pointerType: sourceEvent?.pointerType === 'mouse' ? 'mouse' : 'touch',
      clientX: sourceEvent?.clientX,
      clientY: sourceEvent?.clientY,
    };
    forwardedPointerIDs.add(forwardedEvent.pointerId);
    if (typeof item?.pressStart === 'function') {
      try {
        const token = item.pressStart(forwardedEvent);
        if (token === false) {
          forwardedPointerIDs.delete(forwardedEvent.pointerId);
          return null;
        }
        return { item, custom: true, token, forwardedEvent };
      } catch (_) {
        forwardedPointerIDs.delete(forwardedEvent.pointerId);
        return null;
      }
    }
    const target = resolvePressTarget(item);
    if (!target || !emitOriginalPress(target, 'down', forwardedEvent)) {
      forwardedPointerIDs.delete(forwardedEvent.pointerId);
      return null;
    }
    return { item, target, forwardedEvent };
  }

  function finishForwardedPress(state, sourceEvent, cancelled = false) {
    if (!state) return;
    const forwardedEvent = {
      ...state.forwardedEvent,
      clientX: sourceEvent?.clientX ?? state.forwardedEvent?.clientX,
      clientY: sourceEvent?.clientY ?? state.forwardedEvent?.clientY,
    };
    try {
      if (state.custom && typeof state.item?.pressEnd === 'function') {
        try { state.item.pressEnd(forwardedEvent, cancelled, state.token); } catch (_) {}
        return;
      }
      emitOriginalPress(state.target, cancelled ? 'cancel' : 'up', forwardedEvent);
    } finally {
      forwardedPointerIDs.delete(forwardedEvent.pointerId);
    }
  }

  function normalizedRunState(value) {
    if (value == null) return null;
    if (typeof value === 'boolean') return value ? 'running' : 'cancelled';
    if (typeof value === 'object') {
      const pressed = value.pressed ?? value.checked;
      if (pressed === true || pressed === 'true') return 'running';
      if (pressed === false || pressed === 'false') return 'cancelled';
      value = [value.state, value.phase, value.title, value.label, value.text, value.className].filter(Boolean).join(' ');
    }
    const text = cleanText(value).replace(/\bON\s*[\/·]\s*OFF\b/gi, ' ');
    if (!text) return null;
    if (/(?:^|[\s:=_-])(?:false|off|stopped|inactive|disabled|idle|cancelled|canceled)(?:$|[\s:;,_-])|꺼짐|꺼졌|중지됨|취소됨|비활성/i.test(text)) return 'cancelled';
    if (/(?:^|[\s:=_-])(?:true|on|running|active|enabled)(?:$|[\s:;,_-])|실행\s*중|작동\s*중|켜짐|활성/i.test(text)) return 'running';
    return null;
  }

  function readToolRunState(item) {
    if (typeof item?.stateRead === 'function') {
      try { return normalizedRunState(item.stateRead()); } catch (_) { return null; }
    }
    const target = resolvePressTarget(item);
    if (!target) return null;
    return normalizedRunState({
      pressed: target.getAttribute('aria-pressed'),
      checked: target.getAttribute('aria-checked'),
      state: target.getAttribute('data-state') || target.getAttribute('data-status'),
      phase: target.getAttribute('data-phase'),
      title: target.getAttribute('title'),
      label: target.getAttribute('aria-label'),
      text: target.textContent,
      className: typeof target.className === 'string' ? target.className : '',
    });
  }

  function describedPressActions(element) {
    if (!(element instanceof Element)) return null;
    const description = cleanText([
      element.getAttribute('title'),
      element.getAttribute('aria-description'),
      element.getAttribute('aria-label'),
      element.getAttribute('data-description'),
    ].filter(Boolean).join(' · '));
    if (!/(?:(?:길게|꾹|오래)\s*(?:눌|누르|터치)|롱\s*클릭|long[ -]?press|press\s+and\s+hold)/i.test(description)) return null;
    const shortMatch = description.match(/짧게\s*(?:눌러(?:서)?|누르면|누르기)\s*([^·|,;]+)/i)
      || description.match(/short[ -]?press(?:\s+(?:to|for))?\s*([^·|,;]+)/i);
    const longMatch = description.match(/(?:길게|꾹|오래)\s*(?:눌러(?:서)?|누르면|누르기|터치(?:하면)?)\s*([^·|,;]+)/i)
      || description.match(/(?:롱\s*클릭|long[ -]?press|press\s+and\s+hold)(?:\s+(?:to|for))?\s*([^·|,;]+)/i);
    let shortLabel = cleanText(shortMatch?.[1]) || '기본 실행';
    let longLabel = cleanText(longMatch?.[1]) || '길게 누르기';
    if (/^(?:on\s*[\/·]\s*off|켜기\s*[\/·]\s*끄기)$/i.test(shortLabel)) shortLabel = '실행 / 실행 취소';
    if (/설정|setting/i.test(longLabel)) longLabel = '설정';
    return { shortLabel: shortLabel.slice(0, 24), longLabel: longLabel.slice(0, 24) };
  }

  async function runSyntheticLongPress(item) {
    const sourceEvent = {
      pointerId: Math.floor(Date.now() % 100000) + 1000,
      pointerType: navigator.maxTouchPoints > 0 ? 'touch' : 'mouse',
    };
    const state = beginForwardedPress(item, sourceEvent);
    if (!state) return false;
    await new Promise(resolve => w.setTimeout(resolve, LONG_PRESS_MS + 40));
    finishForwardedPress(state, sourceEvent, false);
    return true;
  }

  async function runSyntheticShortPress(item) {
    const sourceEvent = {
      pointerId: Math.floor(Date.now() % 100000) + 2000,
      pointerType: navigator.maxTouchPoints > 0 ? 'touch' : 'mouse',
    };
    const state = beginForwardedPress(item, sourceEvent);
    if (!state) return false;
    await new Promise(resolve => w.setTimeout(resolve, 36));
    finishForwardedPress(state, sourceEvent, false);
    return true;
  }

  function hidePocketWhileExternalOverlayIsOpen(root) {
    if (!root?.querySelectorAll || !pocket?.host) return;
    const overlays = () => [...root.querySelectorAll('[role="dialog"],[aria-modal="true"],[data-modal]')];
    const isOpen = () => overlays().some(element => visible(element));
    if (!isOpen()) return;
    let observer = null;
    let timer = 0;
    const finish = () => {
      observer?.disconnect();
      clearTimeout(timer);
      pocket?.host?.classList.remove('external-tool-open');
    };
    const sync = () => {
      if (!root.host?.isConnected || !isOpen()) finish();
    };
    pocket.host.classList.add('external-tool-open');
    try {
      observer = new MutationObserver(sync);
      observer.observe(root, { attributes: true, childList: true, subtree: true });
    } catch (_) {}
    timer = w.setTimeout(finish, 10 * 60 * 1000);
  }

  function makePressActionChildren(candidate) {
    const info = describedPressActions(candidate.element);
    if (!info) return null;
    const source = {
      element: candidate.element,
      pressTarget: () => {
        try { return typeof candidate.pressTarget === 'function' ? candidate.pressTarget() : candidate.element; }
        catch (_) { return candidate.element; }
      },
      pressStart: candidate.pressStart,
      pressEnd: candidate.pressEnd,
      stateRead: candidate.stateRead,
    };
    return [
      {
        id: `${candidate.id}:short-press`,
        label: info.shortLabel,
        icon: '▶︎',
        forwardPress: false,
        stateRead: source.stateRead,
        run: candidate.run || (() => runSyntheticShortPress(source)),
      },
      {
        id: `${candidate.id}:long-press`,
        label: info.longLabel,
        icon: iconFor(info.longLabel, '⚙️'),
        forwardPress: false,
        run: async () => {
          const worked = await runSyntheticLongPress(source);
          const target = resolvePressTarget(source);
          const root = target?.getRootNode?.();
          if (root instanceof ShadowRoot) hidePocketWhileExternalOverlayIsOpen(root);
          return worked;
        },
      },
    ];
  }
  const cleanText = (value) => String(value || '')
    .replace(/드래그(?:하여|로)?\s*이동[^·|]*/g, '')
    .replace(/클릭(?:하여)?/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[·|\s]+|[·|\s]+$/g, '')
    .trim();
  const clickable = (element) => element?.closest?.(TOOL_CONTROL_SELECTOR) || element || null;
  const humanizeToken = value => cleanText(String(value || '')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' '));
  const friendlyToolName = value => {
    const text = humanizeToken(value);
    const key = text.toLowerCase().replace(/\s+/g, '');
    const names = {
      capture: '캡처', store: '저장', save: '저장', library: '저장함', sync: '동기화',
      review: '검토', generate: '생성', summary: '요약', settings: '설정', setting: '설정',
      history: '이력', memo: '메모', search: '검색', add: '추가', close: '닫기', open: '열기',
    };
    return names[key] || text;
  };
  const accessibleName = (element, fallback = '도구') => {
    const explicit = [
      element?.getAttribute?.('aria-label'), element?.getAttribute?.('title'),
      element?.getAttribute?.('data-label'), element?.getAttribute?.('data-name'),
      element?.getAttribute?.('data-action'), element?.getAttribute?.('data-view'),
      element?.getAttribute?.('data-testid'), element?.getAttribute?.('name'),
    ].map(cleanText).find(Boolean);
    const visibleText = cleanText(element?.textContent || element?.value);
    const usefulText = /[0-9A-Za-z가-힣]/.test(visibleText) ? visibleText : '';
    return friendlyToolName(explicit || usefulText || element?.id || fallback) || fallback;
  };
  const displayControlName = (element, fallback = '도구') => {
    const visibleText = cleanText(element?.textContent || element?.value);
    if (/[0-9A-Za-z가-힣]/.test(visibleText) && visibleText.length <= 48) return friendlyToolName(visibleText);
    return accessibleName(element, fallback);
  };

  function addViewportMeta() {
    let meta = d.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = d.createElement('meta');
      meta.name = 'viewport';
      (d.head || d.documentElement).appendChild(meta);
    }
    const parts = new Set(String(meta.content || '').split(',').map(part => part.trim()).filter(Boolean));
    ['width=device-width', 'initial-scale=1', 'viewport-fit=cover', 'interactive-widget=resizes-content'].forEach(part => parts.add(part));
    meta.content = [...parts].join(', ');
  }

  function pageThemeColor() {
    const candidates = [
      d.querySelector('main#contents'),
      d.querySelector('[data-sentry-component="ChatRoomViewContainer"]'),
      d.querySelector('[data-sentry-source-file="ChatRoomInputArea.tsx"]'),
      d.body,
    ];
    for (const element of candidates) {
      if (!element) continue;
      const color = getComputedStyle(element).backgroundColor;
      if (!color || color === 'transparent') continue;
      const commaAlpha = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/i);
      const slashAlpha = color.match(/\/\s*([\d.]+)(%)?\s*\)$/);
      const alpha = commaAlpha ? Number(commaAlpha[1]) : slashAlpha ? Number(slashAlpha[1]) / (slashAlpha[2] ? 100 : 1) : 1;
      if (Number.isFinite(alpha) && alpha >= 0.85) return color;
    }
    const declared = [...d.querySelectorAll('meta[name="theme-color"]')]
      .find(meta => meta.id !== THEME_META_ID && meta.content)?.content;
    return declared || (w.matchMedia?.('(prefers-color-scheme: dark)').matches ? '#111113' : '#ffffff');
  }

  function syncThemeColor(force = false) {
    const now = Date.now();
    if (!force && now - lastThemeSync < 400) return;
    lastThemeSync = now;
    const color = pageThemeColor();
    d.documentElement.style.setProperty('--zfp-page-bg', color);
    let meta = d.getElementById(THEME_META_ID);
    if (!meta) {
      meta = d.createElement('meta');
      meta.id = THEME_META_ID;
      meta.name = 'theme-color';
      (d.head || d.documentElement).appendChild(meta);
    }
    if (meta.content !== color) meta.content = color;
  }

  function installPageStyle() {
    d.getElementById(STYLE_ID)?.remove();
    const style = d.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root{
        --zfp-vv-height:100dvh;
        --zfp-vv-width:100vw;
        --zfp-vv-top:0px;
        --zfp-vv-left:0px;
        --zfp-keyboard:0px;
      }
      html.zfp-screen{
        width:100%!important;
        height:var(--zfp-vv-height)!important;
        min-height:var(--zfp-vv-height)!important;
        max-height:var(--zfp-vv-height)!important;
        overflow:hidden!important;
        overscroll-behavior:none!important;
        -webkit-text-size-adjust:100%!important;
        background-color:var(--zfp-page-bg,Canvas)!important;
      }
      html.zfp-screen body{
        position:fixed!important;
        left:var(--zfp-vv-left)!important;
        top:var(--zfp-vv-top)!important;
        width:var(--zfp-vv-width)!important;
        height:var(--zfp-vv-height)!important;
        min-height:0!important;
        max-height:var(--zfp-vv-height)!important;
        margin:0!important;
        overflow:hidden!important;
        overscroll-behavior:none!important;
      }
      html.zfp-screen body>div:first-child,
      html.zfp-screen #__next,
      html.zfp-screen #root{
        width:100%!important;
        height:100%!important;
        min-height:0!important;
        max-height:100%!important;
        overflow:hidden!important;
      }
      html.zfp-screen main#contents{
        width:100%!important;
        height:100%!important;
        min-height:0!important;
        max-height:100%!important;
        overflow:hidden!important;
      }
      html.zfp-screen [data-sentry-component="ChatRoomViewContainer"]{
        min-height:0!important;
        max-height:calc(var(--zfp-vv-height) - 52px)!important;
        overscroll-behavior:none!important;
      }
      html.zfp-screen [data-sentry-component="ChatMessageList"]{
        min-height:0!important;
        overscroll-behavior-y:contain!important;
        -webkit-overflow-scrolling:touch!important;
        overflow-anchor:none!important;
      }
      html.zfp-screen [data-sentry-source-file="ChatRoomInputArea.tsx"]{
        flex:none!important;
        position:relative!important;
        z-index:3!important;
        padding-bottom:max(8px,env(safe-area-inset-bottom))!important;
      }
      html.zfp-screen.zfp-keyboard [data-sentry-source-file="ChatRoomInputArea.tsx"]{
        padding-bottom:8px!important;
      }
      [${MANAGED_ATTR}="1"]{
        opacity:0!important;
        visibility:hidden!important;
        pointer-events:none!important;
        user-select:none!important;
        -webkit-user-select:none!important;
      }
      [${MANAGED_ATTR}="1"] *{
        visibility:hidden!important;
        pointer-events:none!important;
        user-select:none!important;
        -webkit-user-select:none!important;
      }
      body.zfp-editing [data-sentry-component="ChatMessageList"]{
        -webkit-overflow-scrolling:touch!important;
        overscroll-behavior:contain!important;
      }
      @media (min-width:700px){
        body.zfp-editing [data-zfp-edit-sheet="1"]{
          box-sizing:border-box!important;
          width:calc(100vw - 32px)!important;
          min-width:0!important;
          max-width:calc(100vw - 32px)!important;
          margin-left:auto!important;
          margin-right:auto!important;
        }
      }
    `;
    (d.head || d.documentElement).appendChild(style);
  }

  function viewportInfo() {
    const vv = w.visualViewport;
    return {
      width: Math.max(1, Math.round(vv?.width || w.innerWidth || d.documentElement.clientWidth || 1)),
      height: Math.max(1, Math.round(vv?.height || w.innerHeight || d.documentElement.clientHeight || 1)),
      left: Math.max(0, Math.round(vv?.offsetLeft || 0)),
      top: Math.max(0, Math.round(vv?.offsetTop || 0)),
    };
  }

  function deepActiveElement() {
    let active = d.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  }

  function isTextControl(element) {
    return Boolean(element?.matches?.('textarea,input:not([type="button"]):not([type="checkbox"]):not([type="radio"]),[contenteditable="true"]'));
  }

  function isPocketTextControl(element) {
    return Boolean(element && pocket?.shadow && element.getRootNode?.() === pocket.shadow && isTextControl(element));
  }

  function closestAcrossRoots(element, selector) {
    for (let current = element; current;) {
      if (current.matches?.(selector)) return current;
      const root = current.getRootNode?.();
      current = current.parentElement || (root instanceof ShadowRoot ? root.host : null);
    }
    return null;
  }

  function isExternalToolElement(element) {
    return Boolean(closestAcrossRoots(element, EXTERNAL_TOOL_ROOT_SELECTOR));
  }

  function isExternalToolTextControl(element) {
    return isTextControl(element) && isExternalToolElement(element);
  }

  function shouldPauseExternalViewport() {
    return isExternalToolTextControl(deepActiveElement()) || Date.now() < externalViewportHoldUntil;
  }

  function releaseExternalViewportAfterKeyboard() {
    externalViewportHoldUntil = Date.now() + 650;
    clearTimeout(externalViewportResumeTimer);
    externalViewportResumeTimer = w.setTimeout(() => {
      externalViewportResumeTimer = 0;
      if (!isExternalToolTextControl(deepActiveElement())) queueViewport(false);
    }, 680);
  }

  function syncViewport(keepInputVisible = false) {
    if (shouldPauseExternalViewport()) return;
    syncThemeColor();
    const info = viewportInfo();
    const root = d.documentElement;
    const active = deepActiveElement();
    const textFocused = isTextControl(active);
    const widthChanged = !keyboardBaselineWidth || Math.abs(keyboardBaselineWidth - info.width) > 48;
    const naturalHeight = Math.max(w.innerHeight || 0, info.height);
    const layoutHeight = widthChanged ? naturalHeight : Math.max(naturalHeight, root.clientHeight || 0);
    if (!keyboardBaselineHeight || widthChanged || !textFocused) {
      keyboardBaselineWidth = info.width;
      keyboardBaselineHeight = layoutHeight;
    } else {
      keyboardBaselineHeight = Math.max(keyboardBaselineHeight, layoutHeight);
    }
    const keyboardHeight = textFocused ? Math.max(0, keyboardBaselineHeight - info.height - info.top) : 0;
    const keyboardOpen = keyboardHeight > 100;

    root.style.setProperty('--zfp-vv-height', `${info.height}px`);
    root.style.setProperty('--zfp-vv-width', `${info.width}px`);
    root.style.setProperty('--zfp-vv-top', `${info.top}px`);
    root.style.setProperty('--zfp-vv-left', `${info.left}px`);
    root.style.setProperty('--zfp-keyboard', `${keyboardHeight}px`);
    root.classList.add('zfp-screen');
    root.classList.toggle('zfp-keyboard', keyboardOpen);
    const pageKeyboardOpen = keyboardOpen && !isPocketTextControl(active);
    pocket?.host?.classList.toggle('keyboard', pageKeyboardOpen);
    if (pageKeyboardOpen) pocket?.close?.();

    syncEditWindow();
    if (keepInputVisible && isTextControl(active) && Date.now() > editCaretGuardUntil) {
      w.setTimeout(() => {
        try { active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }); } catch (_) {}
      }, 30);
    }
  }

  function queueViewport(keepInputVisible = false) {
    viewportKeepInput = viewportKeepInput || keepInputVisible;
    if (viewportFrame) return;
    viewportFrame = requestAnimationFrame(() => {
      viewportFrame = 0;
      const keep = viewportKeepInput;
      viewportKeepInput = false;
      syncViewport(keep);
      pocket?.placeLauncher?.();
      pocket?.placePanel?.();
    });
  }

  function rememberEditStyle(element) {
    if (element && !editSavedStyles.has(element)) editSavedStyles.set(element, element.getAttribute('style'));
  }

  function editStyle(element, property, value) {
    if (!element) return;
    rememberEditStyle(element);
    element.style.setProperty(property, value, 'important');
  }

  function restoreEditWindow() {
    if (!editActive && editSavedStyles.size === 0) return;
    editSheet?.removeAttribute('data-zfp-edit-sheet');
    editSheet = null;
    editSavedStyles.forEach((style, element) => {
      try { style === null ? element.removeAttribute('style') : element.setAttribute('style', style); } catch (_) {}
    });
    editSavedStyles.clear();
    editActive = false;
    clearEditTypingGuard();
    d.body?.classList.remove('zfp-editing');
  }

  function visibleEditTextarea() {
    return [...d.querySelectorAll('#portal-container textarea')]
      .find(element => visible(element) && !element.closest('[data-sentry-component="ChatInput"]')) || null;
  }

  function editTextareaFromEvent(event) {
    const textarea = event.target;
    if (!(textarea instanceof HTMLTextAreaElement) || !textarea.isConnected) return null;
    if (!textarea.closest('#portal-container') || textarea.closest('[data-sentry-component="ChatInput"]')) return null;
    return textarea;
  }

  function captureEditTypingScroll(textarea) {
    const scrollers = [];
    const seen = new Set([textarea]);
    const remember = element => {
      if (!(element instanceof HTMLElement) || seen.has(element)) return;
      seen.add(element);
      if (element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1) {
        scrollers.push({ element, top: element.scrollTop, left: element.scrollLeft });
      }
    };
    for (let element = textarea.parentElement; element; element = element.parentElement) remember(element);
    remember(d.querySelector('[data-sentry-component="ChatMessageList"]'));
    return { textarea, scrollers, pageX: w.scrollX, pageY: w.scrollY, until: Date.now() + 700 };
  }

  function restoreEditTypingScroll(lock = editTypingLock) {
    if (!lock || !lock.textarea?.isConnected || Date.now() > lock.until) return;
    lock.scrollers.forEach(saved => {
      if (!saved.element.isConnected) return;
      if (saved.element.scrollTop !== saved.top) saved.element.scrollTop = saved.top;
      if (saved.element.scrollLeft !== saved.left) saved.element.scrollLeft = saved.left;
    });
    if (w.scrollX !== lock.pageX || w.scrollY !== lock.pageY) {
      try { w.scrollTo(lock.pageX, lock.pageY); } catch (_) {}
    }
  }

  function scheduleEditTypingRestore(lock) {
    if (!lock) return;
    lock.until = Date.now() + 700;
    editTypingLock = lock;
    editCaretGuardUntil = Math.max(editCaretGuardUntil, lock.until);
    cancelAnimationFrame(editTypingFrame);
    editTypingTimers.forEach(timer => clearTimeout(timer));
    editTypingTimers = [];
    editTypingFrame = requestAnimationFrame(() => {
      editTypingFrame = 0;
      restoreEditTypingScroll(lock);
    });
    [40, 120, 280, 560].forEach(delay => {
      editTypingTimers.push(w.setTimeout(() => restoreEditTypingScroll(lock), delay));
    });
  }

  function guardEditTyping(event) {
    const textarea = editTextareaFromEvent(event);
    if (!textarea) return;
    if (event.type === 'keydown' && !(event.key?.length === 1 || /^(?:Backspace|Delete|Enter)$/i.test(event.key))) return;
    const lock = event.type === 'input' && editTypingLock?.textarea === textarea
      ? editTypingLock
      : captureEditTypingScroll(textarea);
    scheduleEditTypingRestore(lock);
  }

  function clearEditTypingGuard() {
    cancelAnimationFrame(editTypingFrame);
    editTypingFrame = 0;
    editTypingTimers.forEach(timer => clearTimeout(timer));
    editTypingTimers = [];
    editTypingLock = null;
  }

  function isAsteriskButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    const name = cleanText([
      button.textContent,
      button.getAttribute('aria-label'),
      button.getAttribute('title'),
      button.getAttribute('data-testid'),
    ].filter(Boolean).join(' '));
    if (/^(?:\*|별표|별표 삽입|애스터리스크)$/i.test(name) || /별표|asterisk/i.test(name)) return true;
    const path = [...button.querySelectorAll('svg path')]
      .map(node => node.getAttribute('d') || '')
      .join('')
      .replace(/[\s,]+/g, '');
    return path.includes('M8.1952v12M35l10.396M311l10.39-6');
  }

  function guardEditAsterisk(event) {
    const button = event.target?.closest?.('button');
    const textarea = visibleEditTextarea();
    if (!button || !textarea || !isAsteriskButton(button) || !button.closest('#portal-container')) return;
    const before = textarea.value;
    const selectionStart = textarea.selectionStart ?? before.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const selectionDirection = textarea.selectionDirection || 'none';
    const textareaScroll = { top: textarea.scrollTop, left: textarea.scrollLeft };
    const scrollers = [];
    const seen = new Set();
    const rememberScroller = element => {
      if (!(element instanceof HTMLElement) || seen.has(element)) return;
      seen.add(element);
      if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
        scrollers.push({ element, top: element.scrollTop, left: element.scrollLeft });
      }
    };
    for (let element = textarea.parentElement; element; element = element.parentElement) rememberScroller(element);
    rememberScroller(d.querySelector('[data-sentry-component="ChatMessageList"]'));
    const pageScroll = { x: w.scrollX, y: w.scrollY };
    editCaretGuardUntil = Date.now() + 900;

    const restore = () => {
      if (!textarea.isConnected) return;
      const after = textarea.value;
      let start = Math.min(selectionStart, after.length);
      let end = Math.min(selectionEnd, after.length);
      if (after !== before) {
        let prefix = 0;
        while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
        let suffix = 0;
        while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
        if (selectionStart === selectionEnd && prefix === selectionStart) {
          start = end = Math.max(prefix, after.length - suffix);
        } else if (selectionEnd > selectionStart) {
          const selected = before.slice(selectionStart, selectionEnd);
          const located = after.indexOf(selected, Math.max(0, selectionStart - 2));
          if (located >= 0 && located <= selectionStart + Math.max(4, after.length - before.length + 2)) {
            start = located;
            end = located + selected.length;
          }
        }
      }
      try { textarea.setSelectionRange(start, end, selectionDirection); } catch (_) {}
      textarea.scrollTop = textareaScroll.top;
      textarea.scrollLeft = textareaScroll.left;
      scrollers.forEach(saved => {
        if (!saved.element.isConnected) return;
        saved.element.scrollTop = saved.top;
        saved.element.scrollLeft = saved.left;
      });
      try { w.scrollTo(pageScroll.x, pageScroll.y); } catch (_) {}
    };
    [0, 16, 40, 90, 180, 360, 700].forEach(delay => w.setTimeout(restore, delay));
  }

  function syncEditWindow() {
    cancelAnimationFrame(editFrame);
    editFrame = requestAnimationFrame(() => {
      const textarea = visibleEditTextarea();
      if (!textarea) {
        restoreEditWindow();
        return;
      }
      if (editSavedStyles.size) restoreEditWindow();
      const keyboardView = textarea.closest('[data-sentry-component="KeyboardAvoidingView"]');
      let sheet = textarea;
      while (sheet.parentElement && sheet.parentElement !== keyboardView) sheet = sheet.parentElement;
      if (editSheet && editSheet !== sheet) editSheet.removeAttribute('data-zfp-edit-sheet');
      editSheet = sheet;
      editSheet?.setAttribute('data-zfp-edit-sheet', '1');
      editActive = true;
      d.body?.classList.add('zfp-editing');
    });
  }

  function ensureHideStyle(root) {
    if (!root?.querySelector || root.querySelector(`style[${HIDE_STYLE_ATTR}]`)) return;
    const style = d.createElement('style');
    style.setAttribute(HIDE_STYLE_ATTR, '1');
    style.textContent = `[${MANAGED_ATTR}="1"]{opacity:0!important;visibility:hidden!important;pointer-events:none!important;user-select:none!important;-webkit-user-select:none!important}[${MANAGED_ATTR}="1"] *{visibility:hidden!important;pointer-events:none!important;user-select:none!important;-webkit-user-select:none!important}`;
    if (root instanceof Document) (root.head || root.documentElement).appendChild(style);
    else root.appendChild(style);
  }

  function hideOriginal(element, root = d) {
    if (!(element instanceof HTMLElement)) return;
    if (!hiddenTargets.has(element)) {
      hiddenTargets.set(element, handoffOriginals.get(element) || {
        filter: element.style.getPropertyValue('filter'),
        filterPriority: element.style.getPropertyPriority('filter'),
        opacity: element.style.getPropertyValue('opacity'),
        opacityPriority: element.style.getPropertyPriority('opacity'),
        visibility: element.style.getPropertyValue('visibility'),
        visibilityPriority: element.style.getPropertyPriority('visibility'),
        pointerEvents: element.style.getPropertyValue('pointer-events'),
        pointerPriority: element.style.getPropertyPriority('pointer-events'),
        inert: element.hasAttribute('inert'),
      });
      handoffOriginals.delete(element);
    }
    element.setAttribute(MANAGED_ATTR, '1');
    element.setAttribute('inert', '');
    element.style.setProperty('opacity', '0', 'important');
    element.style.setProperty('visibility', 'hidden', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
    ensureHideStyle(root);
  }

  function restoreOriginals() {
    [...hiddenTargets.keys()].forEach(restoreTarget);
    hiddenTargets.clear();
    allRoots().forEach(root => root.querySelector?.(`style[${HIDE_STYLE_ATTR}]`)?.remove());
  }

  function restoreTarget(element) {
    const saved = hiddenTargets.get(element);
    if (!saved) return;
    try {
      element.removeAttribute(MANAGED_ATTR);
      saved.inert ? element.setAttribute('inert', '') : element.removeAttribute('inert');
      saved.filter ? element.style.setProperty('filter', saved.filter, saved.filterPriority) : element.style.removeProperty('filter');
      saved.opacity ? element.style.setProperty('opacity', saved.opacity, saved.opacityPriority) : element.style.removeProperty('opacity');
      saved.visibility ? element.style.setProperty('visibility', saved.visibility, saved.visibilityPriority) : element.style.removeProperty('visibility');
      saved.pointerEvents ? element.style.setProperty('pointer-events', saved.pointerEvents, saved.pointerPriority) : element.style.removeProperty('pointer-events');
    } catch (_) {}
    hiddenTargets.delete(element);
  }

  function restoreHandoffTarget(element) {
    const saved = handoffOriginals.get(element);
    if (!saved) return false;
    try {
      element.removeAttribute(MANAGED_ATTR);
      saved.inert ? element.setAttribute('inert', '') : element.removeAttribute('inert');
      saved.filter ? element.style.setProperty('filter', saved.filter, saved.filterPriority) : element.style.removeProperty('filter');
      saved.opacity ? element.style.setProperty('opacity', saved.opacity, saved.opacityPriority) : element.style.removeProperty('opacity');
      saved.visibility ? element.style.setProperty('visibility', saved.visibility, saved.visibilityPriority) : element.style.removeProperty('visibility');
      saved.pointerEvents ? element.style.setProperty('pointer-events', saved.pointerEvents, saved.pointerPriority) : element.style.removeProperty('pointer-events');
    } catch (_) {}
    handoffOriginals.delete(element);
    return true;
  }

  function allRoots() {
    const roots = [d];
    const seen = new Set(roots);
    for (let index = 0; index < roots.length; index += 1) {
      const root = roots[index];
      root.querySelectorAll?.('*').forEach(element => {
        const nestedRoot = shadowRootOf(element);
        if (nestedRoot && !seen.has(nestedRoot)) {
          seen.add(nestedRoot);
          roots.push(nestedRoot);
        }
      });
    }
    return roots;
  }

  function iconFor(label, fallback = '✦') {
    const text = String(label).toLowerCase();
    if (/auto[ _-]*killer|오토[ _-]*킬러/.test(text)) return '☠️';
    if (/캡처|capture|사진/.test(text)) return '📸';
    if (/요약|summary/.test(text)) return '📝';
    if (/메모|memo/.test(text)) return '🗒️';
    if (/기억|memory/.test(text)) return '🧠';
    if (/게임|zetendo|젯텐도/.test(text)) return '🎮';
    if (/reading|리딩/.test(text)) return '📖';
    if (/튜디오|studio/.test(text)) return '🎬';
    if (/합치기|join/.test(text)) return '🧩';
    if (/검토/.test(text)) return '🔎';
    if (/새답변/.test(text)) return '✨';
    if (/추천/.test(text)) return '💡';
    if (/무응답/.test(text)) return '🔕';
    if (/이력|history/.test(text)) return '🕘';
    if (/설정|setting/.test(text)) return '⚙️';
    if (/동기화|sync/.test(text)) return '🔄';
    if (/로어|lore/.test(text)) return '📚';
    if (/검색|search/.test(text)) return '🔍';
    if (/추가|add/.test(text)) return '＋';
    return fallback;
  }

  const customizationKey = (actionID, childID = '') => childID ? `${actionID}::${childID}` : actionID;
  function presentation(item, parentID = '') {
    const custom = customizations[customizationKey(parentID || item.id, parentID ? item.id : '')] || {};
    const label = cleanText(custom.label) || item.label || '도구';
    return { label, icon: cleanText(custom.icon) || item.icon || iconFor(label) };
  }

  function persistCustomizations() {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customizations)); } catch (_) {}
  }

  function bookmarkletSnapshot(items = savedBookmarklets) {
    return (Array.isArray(items) ? items : []).filter(item => item?.id && item?.code).map(item => ({
      id: String(item.id),
      label: cleanText(item.label) || '저장한 북마클릿',
      icon: cleanText(item.icon) || '🔖',
      code: String(item.code),
      autoOpen: item.autoOpen !== false,
    }));
  }

  function cacheSavedBookmarklets() {
    w[BOOKMARKLETS_CACHE_GLOBAL] = bookmarkletSnapshot();
  }

  function openBookmarkletDatabase() {
    return new Promise((resolve, reject) => {
      if (!w.indexedDB) {
        reject(new Error('IndexedDB를 사용할 수 없습니다.'));
        return;
      }
      const request = w.indexedDB.open(BOOKMARKLETS_DB_NAME, BOOKMARKLETS_DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(BOOKMARKLETS_STORE)) database.createObjectStore(BOOKMARKLETS_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB 열기 실패'));
      request.onblocked = () => reject(new Error('IndexedDB가 다른 탭에서 사용 중입니다.'));
    });
  }

  async function readBookmarkletsFromIndexedDB() {
    const database = await openBookmarkletDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(BOOKMARKLETS_STORE, 'readonly');
        const request = transaction.objectStore(BOOKMARKLETS_STORE).get(BOOKMARKLETS_RECORD_KEY);
        let result = null;
        request.onsuccess = () => { result = request.result ?? null; };
        request.onerror = () => reject(request.error || new Error('북마클릿 불러오기 실패'));
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () => reject(transaction.error || new Error('북마클릿 불러오기 중단'));
      });
    } finally {
      database.close();
    }
  }

  async function writeBookmarkletsToIndexedDB(items) {
    const database = await openBookmarkletDatabase();
    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(BOOKMARKLETS_STORE, 'readwrite');
        transaction.objectStore(BOOKMARKLETS_STORE).put(bookmarkletSnapshot(items), BOOKMARKLETS_RECORD_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('북마클릿 저장 실패'));
        transaction.onabort = () => reject(transaction.error || new Error('북마클릿 저장 중단'));
      });
    } finally {
      database.close();
    }
  }

  function ensureBookmarkletStorageReady() {
    if (bookmarkletStorageReady) return bookmarkletStorageReady;
    bookmarkletStorageReady = (async () => {
      try {
        const stored = await readBookmarkletsFromIndexedDB();
        const merged = new Map();
        bookmarkletSnapshot(stored).forEach(item => merged.set(item.id, item));
        bookmarkletSnapshot(savedBookmarklets).forEach(item => merged.set(item.id, item));
        savedBookmarklets = [...merged.values()];
        bookmarkletStorageMode = 'indexeddb';
        await writeBookmarkletsToIndexedDB(savedBookmarklets);
        try { localStorage.removeItem(BOOKMARKLETS_KEY); } catch (_) {}
      } catch (error) {
        bookmarkletStorageMode = 'localstorage';
        console.warn('[Zeta Pocket] IndexedDB를 열지 못해 기존 저장소를 사용합니다.', error);
        try { localStorage.setItem(BOOKMARKLETS_KEY, JSON.stringify(savedBookmarklets)); } catch (_) {}
      }
      cacheSavedBookmarklets();
      registerSavedBookmarklets();
      pocket?.render?.();
      return bookmarkletStorageMode;
    })();
    return bookmarkletStorageReady;
  }

  async function persistSavedBookmarklets() {
    await ensureBookmarkletStorageReady();
    const snapshot = bookmarkletSnapshot();
    savedBookmarklets = snapshot;
    cacheSavedBookmarklets();
    if (bookmarkletStorageMode === 'indexeddb') {
      const write = bookmarkletWriteQueue.catch(() => {}).then(() => writeBookmarkletsToIndexedDB(snapshot));
      bookmarkletWriteQueue = write;
      try {
        await write;
        try { localStorage.removeItem(BOOKMARKLETS_KEY); } catch (_) {}
        return;
      } catch (error) {
        bookmarkletStorageMode = 'localstorage';
        console.warn('[Zeta Pocket] IndexedDB 저장에 실패해 기존 저장소로 전환합니다.', error);
      }
    }
    localStorage.setItem(BOOKMARKLETS_KEY, JSON.stringify(snapshot));
  }

  function normalizeBookmarkletCode(code) {
    let source = String(code || '').trim().replace(/^javascript\s*:/i, '').trim();
    if (/%[0-9a-f]{2}/i.test(source)) {
      try { source = decodeURIComponent(source); } catch (_) {}
    }
    return source;
  }

  function bookmarkletLauncherElements() {
    const found = [];
    allRoots().forEach(root => root.querySelectorAll?.('button,[role="button"],a,[tabindex]').forEach(element => {
      if (!(element instanceof HTMLElement) || element.closest?.(`#${HOST_ID}`) || !visible(element)) return;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const zIndex = Number.parseInt(style.zIndex, 10) || 0;
      if (!['fixed', 'absolute', 'sticky'].includes(style.position) || zIndex < 1000) return;
      if (rect.width < 16 || rect.height < 16 || rect.width > 160 || rect.height > 160) return;
      found.push(element);
    }));
    return found;
  }

  async function executeSavedBookmarklet(entry) {
    const runtime = bookmarkletRuntimes.get(entry.id);
    const current = runtime?.launcher;
    if (current?.isConnected) {
      if (performance.now() - (runtime.forwardedAt || 0) < 250) return true;
      const pointer = { pointerId: Date.now() % 100000, pointerType: 'touch' };
      emitOriginalPress(current, 'down', pointer);
      emitOriginalPress(current, 'up', pointer);
      return true;
    }

    const source = normalizeBookmarkletCode(entry.code);
    if (!source) return false;
    const before = new Set(bookmarkletLauncherElements());
    const execute = new Function(`${source}\n//# sourceURL=zeta-pocket-bookmarklet-${entry.id}.js`);
    execute.call(w);

    let launcher = null;
    for (const delay of [0, 60, 140, 280, 520]) {
      if (delay) await new Promise(resolve => w.setTimeout(resolve, delay));
      const created = bookmarkletLauncherElements().filter(element => !before.has(element));
      launcher = created.find(element => /열기|open|launcher|도구|스튜디오/i.test(accessibleName(element))) || created[0] || null;
      if (launcher) break;
    }
    if (!launcher) return true;

    launcher.setAttribute(BOOKMARKLET_LAUNCHER_ATTR, entry.id);
    const nextRuntime = { launcher, forwardedAt: 0 };
    bookmarkletRuntimes.set(entry.id, nextRuntime);
    if (entry.autoOpen !== false) {
      const pointer = { pointerId: Date.now() % 100000, pointerType: 'touch' };
      emitOriginalPress(launcher, 'down', pointer);
      emitOriginalPress(launcher, 'up', pointer);
    }
    hideOriginal(launcher, launcher.getRootNode() instanceof ShadowRoot ? launcher.getRootNode() : d);
    return true;
  }

  async function removeSavedBookmarklet(id) {
    await ensureBookmarkletStorageReady();
    const previous = savedBookmarklets;
    savedBookmarklets = savedBookmarklets.filter(item => item.id !== id);
    try {
      await persistSavedBookmarklets();
    } catch (_) {
      savedBookmarklets = previous;
      cacheSavedBookmarklets();
      pocket?.toast?.('북마클릿 삭제 내용을 저장하지 못했어요');
      return;
    }
    const runtime = bookmarkletRuntimes.get(id);
    if (runtime?.launcher) {
      restoreTarget(runtime.launcher);
      runtime.launcher.removeAttribute(BOOKMARKLET_LAUNCHER_ATTR);
    }
    bookmarkletRuntimes.delete(id);
    delete customizations[customizationKey(id)];
    persistCustomizations();
    actions.delete(id);
    pocket?.render?.();
    pocket?.toast?.('저장한 북마클릿을 삭제했어요');
  }

  function registerSavedBookmarklets() {
    const savedIDs = new Set(savedBookmarklets.map(item => item.id));
    [...actions.keys()].filter(id => id.startsWith('bookmarklet:') && !savedIDs.has(id)).forEach(id => actions.delete(id));
    allRoots().forEach(root => root.querySelectorAll?.(`[${BOOKMARKLET_LAUNCHER_ATTR}]`).forEach(launcher => {
      const id = launcher.getAttribute(BOOKMARKLET_LAUNCHER_ATTR);
      if (!savedBookmarklets.some(item => item.id === id)) return;
      bookmarkletRuntimes.set(id, { launcher, forwardedAt: 0 });
      hideOriginal(launcher, root instanceof ShadowRoot ? root : d);
    }));
    savedBookmarklets.forEach((entry, index) => {
      addAction({
        id: entry.id,
        label: entry.label || '저장한 북마클릿',
        icon: entry.icon || '🔖',
        group: '북마클릿',
        order: 700 + index,
        removable: true,
        onRemove: () => { void removeSavedBookmarklet(entry.id); },
        pressStart: event => {
          const runtime = bookmarkletRuntimes.get(entry.id);
          if (!runtime?.launcher?.isConnected) return false;
          if (!emitOriginalPress(runtime.launcher, 'down', event)) return false;
          return runtime;
        },
        pressEnd: (event, cancelled, runtime) => {
          if (!runtime?.launcher?.isConnected) return;
          emitOriginalPress(runtime.launcher, cancelled ? 'cancel' : 'up', event);
          runtime.forwardedAt = performance.now();
        },
        run: () => executeSavedBookmarklet(entry),
      });
    });
  }

  function addAction({ id, label, icon, group = '도구', order = 500, run, element = null, removable = false, onRemove = null, children = null, pressTarget = null, pressStart = null, pressEnd = null, stateRead = null }) {
    if (!id || typeof run !== 'function') return;
    actions.set(id, { id, label: cleanText(label) || '도구', icon: icon || iconFor(label), group, order, run, element, removable, onRemove, children, pressTarget, pressStart, pressEnd, stateRead });
    pocket?.render?.();
  }

  function persistSelection() {
    try { localStorage.setItem(SELECTION_KEY, JSON.stringify([...selectedIDs])); } catch (_) {}
  }

  function migrateSelection(oldIDs, newID) {
    const legacy = [...new Set((oldIDs || []).map(String))].filter(id => id && id !== newID);
    if (!legacy.some(id => selectedIDs.has(id))) return false;
    legacy.forEach(id => {
      selectedIDs.delete(id);
      actions.delete(id);
    });
    selectedIDs.add(newID);
    for (const key of Object.keys(capturedFingerprints)) {
      if (legacy.includes(capturedFingerprints[key])) capturedFingerprints[key] = newID;
    }
    try { localStorage.setItem(FINGERPRINT_KEY, JSON.stringify(capturedFingerprints)); } catch (_) {}
    persistSelection();
    return true;
  }

  function candidateHideTargets(candidate) {
    return [...new Set([candidate?.hideTarget, ...(candidate?.extraHideTargets || [])])]
      .filter(target => target instanceof HTMLElement);
  }

  function hideCandidateTargets(candidate) {
    candidateHideTargets(candidate).forEach(target => {
      if (!target.isConnected || temporarilyVisibleTargets.has(target)) return;
      const root = target.getRootNode?.();
      hideOriginal(target, root instanceof ShadowRoot ? root : d);
    });
  }

  function activateCandidate(id) {
    const candidate = candidates.get(id);
    if (!candidate?.element?.isConnected) return;
    hideCandidateTargets(candidate);
    addAction({
      id,
      label: candidate.label,
      icon: candidate.icon,
      group: candidate.group,
      order: candidate.order,
      element: candidate.element?.isConnected ? candidate.element : null,
      removable: true,
      children: candidate.children,
      pressTarget: candidate.pressTarget || (() => candidate.element),
      pressStart: candidate.pressStart,
      pressEnd: candidate.pressEnd,
      stateRead: candidate.stateRead,
      run: candidate.run || (() => {
        if (!candidate.element.isConnected) return false;
        try { candidate.element.click(); }
        catch (_) { candidate.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: w })); }
        return true;
      }),
    });
  }

  function enroll(ids) {
    const added = [];
    ids.forEach(id => {
      if (!candidates.has(id) || selectedIDs.has(id)) return;
      selectedIDs.add(id);
      rememberCapturedCandidate(candidates.get(id));
      activateCandidate(id);
      added.push(id);
    });
    if (!added.length) return;
    persistSelection();
    pocket?.render?.();
    const label = added.length === 1 ? candidates.get(added[0])?.label : `${added.length}개 도구`;
    pocket?.toast?.(`${label || '도구'}를 주머니에 담았어요`);
  }

  function unenroll(id, message = '') {
    id = String(id);
    const candidate = candidates.get(id);
    selectedIDs.delete(id);
    for (const [fingerprint, storedID] of Object.entries(capturedFingerprints)) {
      if (storedID === id) delete capturedFingerprints[fingerprint];
    }
    try {localStorage.setItem(FINGERPRINT_KEY,JSON.stringify(capturedFingerprints))}catch(_){}
    actions.delete(id);
    persistSelection();
    candidateHideTargets(candidate).forEach(target => {
      const shared = [...candidates.values()].some(other =>
        other.id !== id && selectedIDs.has(other.id) && candidateHideTargets(other).includes(target)
      );
      if (!shared) restoreTarget(target);
    });
    pocket?.render?.();
    pocket?.toast?.(message || `${candidate?.label || '도구'}를 밖으로 꺼냈어요`);
  }

  function runSelectedToggle(id, invoke, openCheck) {
    const candidate = candidates.get(String(id));
    const target = candidate?.hideTarget;
    if (!target?.isConnected || !selectedIDs.has(String(id))) return invoke();
    temporarilyVisibleTargets.add(target);
    restoreTarget(target);
    let observer = null;
    let timer = 0;
    const finish = () => {
      observer?.disconnect();
      clearTimeout(timer);
      temporarilyVisibleTargets.delete(target);
      if (selectedIDs.has(String(id)) && target.isConnected) hideOriginal(target, candidate.root);
    };
    const sync = () => {
      if (!selectedIDs.has(String(id)) || !target.isConnected) {
        observer?.disconnect();
        clearTimeout(timer);
        temporarilyVisibleTargets.delete(target);
        return;
      }
      let opened = null;
      try { opened = openCheck(); } catch (_) {}
      if (opened === false) finish();
    };
    const beginMonitoring = () => {
      try {
        observer = new MutationObserver(sync);
        observer.observe(target, { attributes: true, childList: true, subtree: true, characterData: true });
      } catch (_) {}
      timer = w.setTimeout(finish, 10 * 60 * 1000);
      [0, 40, 140].forEach(delay => w.setTimeout(sync, delay));
    };
    let result = false;
    try { result = invoke(); }
    catch (error) { finish(); throw error; }
    if (result && typeof result.then === 'function') {
      return Promise.resolve(result).then(value => {
        beginMonitoring();
        return value;
      }, error => {
        finish();
        throw error;
      });
    }
    beginMonitoring();
    return result;
  }

  function registerElement(element, config = {}) {
    if (!(element instanceof HTMLElement) || element.closest?.(`#${HOST_ID}`)) return;
    let existingID = elementActions.get(element);
    if (existingID && config.id && existingID !== config.id) {
      const wasSelected = selectedIDs.delete(existingID);
      actions.delete(existingID);
      candidates.delete(existingID);
      elementActions.delete(element);
      if (wasSelected) selectedIDs.add(config.id);
      if (wasSelected) persistSelection();
      existingID = null;
    }
    if (existingID) {
      const candidate = candidates.get(existingID);
      if (candidate) {
        const previousHideTarget = candidate.hideTarget;
        const previousExtraHideTargets = candidate.extraHideTargets || [];
        const requestedHideTarget = config.hideTarget || candidate.hideTarget || element;
        const nextHideTarget = requestedHideTarget === element ? visualCarrierForElement(element) : requestedHideTarget;
        const nextExtraHideTargets = (Array.isArray(config.extraHideTargets) ? config.extraHideTargets : previousExtraHideTargets)
          .filter(target => target instanceof HTMLElement && target !== nextHideTarget);
        const nextTargets = new Set([nextHideTarget, ...nextExtraHideTargets]);
        [previousHideTarget, ...previousExtraHideTargets].forEach(target => {
          if (target instanceof HTMLElement && !nextTargets.has(target) && hiddenTargets.has(target)) restoreTarget(target);
        });
        candidate.hideTarget = nextHideTarget;
        candidate.extraHideTargets = nextExtraHideTargets;
        const nextRoot = nextHideTarget?.getRootNode?.();
        candidate.root = nextRoot instanceof ShadowRoot ? nextRoot : d;
        candidate.label = config.label || candidate.label || accessibleName(element);
        candidate.icon = config.icon || candidate.icon || iconFor(candidate.label);
        candidate.group = config.group || candidate.group || '도구';
        candidate.order = config.order ?? candidate.order ?? 500;
        candidate.run = config.run ?? candidate.run;
        candidate.children = config.children ?? candidate.children;
        candidate.pressTarget = config.pressTarget ?? candidate.pressTarget;
        candidate.pressStart = config.pressStart ?? candidate.pressStart;
        candidate.pressEnd = config.pressEnd ?? candidate.pressEnd;
        candidate.stateRead = config.stateRead ?? candidate.stateRead;
        if (!candidate.children) candidate.children = makePressActionChildren(candidate);
        const action = actions.get(existingID);
        if (selectedIDs.has(existingID)) {
          hideCandidateTargets(candidate);
          if (action) {
            Object.assign(action, {
              label: candidate.label,
              icon: candidate.icon,
              group: candidate.group,
              order: candidate.order,
              run: candidate.run || action.run,
              element: candidate.element?.isConnected ? candidate.element : null,
              children: candidate.children,
              pressTarget: candidate.pressTarget || action.pressTarget,
              pressStart: candidate.pressStart || action.pressStart,
              pressEnd: candidate.pressEnd || action.pressEnd,
              stateRead: candidate.stateRead || action.stateRead,
            });
          } else activateCandidate(existingID);
        }
      }
      return existingID;
    }
    const root = element.getRootNode();
    const label = config.label || accessibleName(element);
    const rootName = root instanceof ShadowRoot ? root.host?.id || root.host?.tagName || 'shadow' : 'page';
    const stableName = element.id || element.getAttribute('aria-label') || element.getAttribute('title') || label;
    const id = config.id || `element:${rootName}:${cleanText(stableName).toLowerCase().replace(/[^0-9a-z가-힣]+/g, '-').replace(/^-|-$/g, '')}`;
    const recoveredID = savedIDForLauncher(element);
    const finalID = recoveredID || id;
    const requestedHideTarget = config.hideTarget || element;
    const hideTarget = requestedHideTarget === element ? visualCarrierForElement(element) : requestedHideTarget;
    elementActions.set(element, finalID);
    const candidate = {
      id: finalID,
      element,
      hideTarget,
      extraHideTargets: (Array.isArray(config.extraHideTargets) ? config.extraHideTargets : [])
        .filter(target => target instanceof HTMLElement && target !== hideTarget),
      root: root instanceof ShadowRoot ? root : d,
      label,
      icon: config.icon || iconFor(label),
      group: config.group || '도구',
      order: config.order ?? 500,
      run: config.run,
      children: config.children || null,
      pressTarget: config.pressTarget || (() => element),
      pressStart: config.pressStart || null,
      pressEnd: config.pressEnd || null,
      stateRead: config.stateRead || null,
    };
    if (!candidate.children) candidate.children = makePressActionChildren(candidate);
    candidates.set(finalID, candidate);
    if (selectedIDs.has(finalID)) {rememberCapturedCandidate(candidate);activateCandidate(finalID)}
    return finalID;
  }

  function reviewControls(bar) {
    const seen = new Set();
    return [...(bar?.querySelectorAll?.(TOOL_CONTROL_SELECTOR) || [])].filter(control => {
      const label = cleanText(control.textContent || control.value);
      if (!REVIEW_LABELS.includes(label) || seen.has(label)) return false;
      seen.add(label);
      return true;
    });
  }

  function findReviewBar() {
    const direct = d.getElementById('zk_review_quickbar')
      || d.querySelector('[data-zeta-review-tabbar-drag="true"]');
    if (direct && reviewControls(direct).length >= 3) return direct;

    const scores = new Map();
    d.querySelectorAll(TOOL_CONTROL_SELECTOR).forEach(control => {
      const label = cleanText(control.textContent || control.value);
      if (!REVIEW_LABELS.includes(label)) return;
      for (let container = control.parentElement, depth = 0; container && depth < 7; container = container.parentElement, depth += 1) {
        if (container.id === HOST_ID || container === d.body || container === d.documentElement) break;
        const labels = scores.get(container) || new Set();
        labels.add(label);
        scores.set(container, labels);
      }
    });

    return [...scores.entries()]
      .filter(([, labels]) => labels.size >= 3 && ['검토', '새답변', '추천', '무응답'].filter(label => labels.has(label)).length >= 3)
      .map(([container]) => {
        const rect = container.getBoundingClientRect();
        const style = getComputedStyle(container);
        const marker = toolbarMarker(container);
        const floating = ['fixed', 'absolute', 'sticky'].includes(style.position) || /review|검토|quickbar|tabbar|toolbar/i.test(marker);
        return { container, area: Math.max(1, rect.width * rect.height), floating };
      })
      .filter(item => item.floating)
      .sort((left, right) => left.area - right.area)[0]?.container || null;
  }

  function scanKnownTools() {
    const known = [
      ['#zeta-chat-summary-float-button', '대화 추출·요약', '📝', 20],
      ['#zeta-visible-join-button', '메시지 줄 합치기', '🧩', 30],
      ['#zk-memory-fab', '기억 패치', '🧠', 40],
      ['#zeta-shell-api-export-button', 'API 설정 가져오기', '🔑', 90],
    ];
    known.forEach(([selector, label, icon, order]) => {
      const element = d.querySelector(selector);
      const isVisibleJoin = selector === '#zeta-visible-join-button';
      const extraHideTargets = isVisibleJoin
        ? [d.getElementById('zeta-visible-join-switch')].filter(Boolean)
        : [];
      const children = isVisibleJoin ? [
        {
          id: 'visible-join:paragraphs',
          label: '문단 띄우기',
          icon: '¶',
          forwardPress: false,
          run: () => {
            const control = d.querySelector('#zeta-visible-join-dock [data-mode="paragraphs"]');
            if (!control) return false;
            control.click();
            return true;
          },
        },
        {
          id: 'visible-join:short',
          label: '짧출 스타일',
          icon: '≡',
          forwardPress: false,
          run: () => {
            const control = d.querySelector('#zeta-visible-join-dock [data-mode="short"]');
            if (!control) return false;
            control.click();
            return true;
          },
        },
      ] : null;
      if (element) registerElement(element, { id: `known:${selector}`, label, icon, order, extraHideTargets, children });
    });

    const reviewBar = findReviewBar();
    if (reviewBar) {
      const reviewID = 'review:toolbar';
      const legacy = [...selectedIDs].filter(id => id.startsWith('review:') && id !== reviewID);
      if (legacy.length) {
        legacy.forEach(id => {
          selectedIDs.delete(id);
          actions.delete(id);
        });
        selectedIDs.add(reviewID);
        persistSelection();
      }
      const seen = new Set();
      const children = [];
      reviewControls(reviewBar).forEach(target => {
        const label = cleanText(target.textContent || target.value);
        if (seen.has(label)) return;
        seen.add(label);
        children.push({
          id: `review-child:${label}`,
          label,
          icon: iconFor(label),
          pressTarget: () => {
            const currentBar = findReviewBar();
            return reviewControls(currentBar).find(item => cleanText(item.textContent || item.value) === label) || null;
          },
          run: () => {
            const currentBar = findReviewBar();
            const current = reviewControls(currentBar).find(item => cleanText(item.textContent || item.value) === label);
            if (!current) return false;
            current.click();
            return true;
          },
        });
      });
      if (children.length) {
        registerElement(reviewBar, {
          id: reviewID,
          label: '응답 검토',
          icon: '🔎',
          group: '도구',
          order: 35,
          hideTarget: reviewBar,
          children,
          run: () => {},
        });
      }
    }
  }

  function autoKillerParts() {
    const host = [...d.querySelectorAll('[id^="zk-tm-unified-panel"]')]
      .find(element => !element.id.endsWith('-inside')) || null;
    const root = shadowRootOf(host);
    const panel = root?.querySelector('[id^="zk-tm-unified-panel"][id$="-inside"]') || null;
    const buttons = panel ? [...panel.querySelectorAll('button')] : [];
    const tools = AUTO_KILLER_TOOLS.map(spec => ({
      ...spec,
      button: buttons.find(button => spec.matches(cleanText(button.textContent))),
    })).filter(tool => tool.button);
    return { host, root, panel, tools };
  }

  function scanShadowTools() {
    const screenFit = d.getElementById('zeta-screen-fit-control')?.shadowRoot?.querySelector('#zeta-screen-fit-tool');
    if (screenFit) registerElement(screenFit, { id: 'known:screen-fit', label: '화면 다시 맞춤', icon: '↗', group: '화면', order: 0 });

    const captureHost = d.getElementById('zpc-userscript-launcher');
    const captureRoot = captureHost?.shadowRoot;
    const captureDock = captureRoot?.querySelector('.dock,[role="toolbar"]');
    const captureButtons = captureRoot ? [...captureRoot.querySelectorAll('[data-action]')] : [];
    if (captureRoot) {
      watchCandidateDragRoot(captureRoot);
      watchToolRoot(captureRoot);
    }
    if (captureDock && captureButtons.length) {
      const captureID = 'capture:toolbar';
      const oldTools = toolbarButtons(captureDock);
      const oldLabels = oldTools.map(tool => accessibleName(tool, '도구'));
      const legacyIDs = new Set(['known:#zpc-userscript-launcher']);
      if (oldLabels.length) {
        const oldLabel = automaticToolbarLabel(captureDock, oldLabels);
        legacyIDs.add(automaticToolbarID(captureDock, oldLabel, oldLabels));
      }
      const migrateSelection = [...legacyIDs].some(id => selectedIDs.has(id));
      legacyIDs.forEach(id => {
        selectedIDs.delete(id);
        actions.delete(id);
        candidates.delete(id);
      });
      if (migrateSelection) {
        selectedIDs.add(captureID);
        persistSelection();
      }
      const names = { capture: '캡처', store: '대화 저장', library: '저장함', sync: '동기화' };
      const icons = { capture: '📸', store: '💾', library: '🗃️', sync: '🔄' };
      const children = captureButtons.map((button, index) => {
        const action = button.getAttribute('data-action') || String(index);
        const label = names[action] || accessibleName(button, '캡처 기능');
        return {
          id: `${captureID}:child:${action}`,
          label,
          icon: icons[action] || iconFor(label),
          pressTarget: () => d.getElementById('zpc-userscript-launcher')?.shadowRoot
            ?.querySelector(`[data-action="${action}"]`) || null,
          run: () => {
            const current = d.getElementById('zpc-userscript-launcher')?.shadowRoot
              ?.querySelector(`[data-action="${action}"]`);
            if (!current) return false;
            current.click();
            return true;
          },
        };
      });
      registerElement(captureDock, {
        id: captureID,
        label: '익명 캡처',
        icon: '📸',
        group: '도구',
        order: 10,
        hideTarget: captureDock,
        children,
        run: () => {},
      });
      oldTools.forEach(tool => groupedToolbarElements.add(tool));
    }

    const autoKiller = autoKillerParts();
    if (autoKiller.root) {
      watchCandidateDragRoot(autoKiller.root);
      watchToolRoot(autoKiller.root);
    }
    if (autoKiller.panel && autoKiller.tools.length >= 2) {
      const autoKillerID = 'known:auto-killer';
      migrateSelection(['bridge:auto-killer'], autoKillerID);
      const children = autoKiller.tools.map(tool => ({
        id: `${autoKillerID}:child:${tool.key}`,
        label: tool.label,
        icon: tool.icon,
        pressTarget: () => autoKillerParts().tools.find(item => item.key === tool.key)?.button || null,
        run: () => {
          const current = autoKillerParts();
          const target = current.tools.find(item => item.key === tool.key)?.button;
          if (!target) return false;
          if (tool.key === 'settings' && selectedIDs.has(autoKillerID)) {
            return runSelectedToggle(autoKillerID, () => {
              target.click();
              return true;
            }, () => autoKillerParts().panel?.dataset.settingsOpen === 'true');
          }
          target.click();
          return true;
        },
      }));
      registerElement(autoKiller.panel, {
        id: autoKillerID,
        label: 'AUTO_KILLER',
        icon: '☠️',
        group: '도구',
        order: 15,
        hideTarget: autoKiller.panel,
        children,
        run: () => {},
      });
      autoKiller.tools.forEach(tool => groupedToolbarElements.add(tool.button));
    }

    const personaRoot = d.getElementById('zeta-persona-editor-host')?.shadowRoot;
    const personaButton = personaRoot?.querySelector('#btn');
    if (personaButton) {
      const personaID = 'known:persona-editor';
      registerElement(personaButton, {
        id: personaID,
        label: '페르소나 편집기',
        icon: '👤',
        order: 42,
        hideTarget: personaRoot.host,
        run: () => {
          const button = d.getElementById('zeta-persona-editor-host')?.shadowRoot?.querySelector('#btn');
          if (!button) return false;
          const panel = button.getRootNode()?.querySelector?.('#panel');
          const wasOpen = panel?.classList.contains('open');
          const invoke = () => {
          const rect = button.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const supportsTouch = ('ontouchstart' in w) || navigator.maxTouchPoints > 0;
          try {
            if (supportsTouch) {
              const touch = typeof w.Touch === 'function'
                ? new w.Touch({ identifier: Date.now(), target: button, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x, pageY: y })
                : { identifier: Date.now(), target: button, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x, pageY: y };
              const makeTouchEvent = (type, touches) => {
                if (typeof w.TouchEvent === 'function') return new w.TouchEvent(type, { bubbles: true, cancelable: true, composed: true, touches, targetTouches: touches, changedTouches: [touch] });
                const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
                Object.defineProperties(event, { touches: { value: touches }, targetTouches: { value: touches }, changedTouches: { value: [touch] } });
                return event;
              };
              button.dispatchEvent(makeTouchEvent('touchstart', [touch]));
              w.dispatchEvent(makeTouchEvent('touchend', []));
            } else {
              button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: w, clientX: x, clientY: y }));
              w.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: w, clientX: x, clientY: y }));
            }
          } catch (_) {}
          if (panel && panel.classList.contains('open') === wasOpen) panel.classList.toggle('open', !wasOpen);
          return true;
          };
          if (selectedIDs.has(personaID)) {
            return runSelectedToggle(personaID, invoke, () => panel?.classList.contains('open') || false);
          }
          return invoke();
        },
      });
    }

    const memoHost = d.getElementById('zk_memo_dock');
    const memoRoot = memoHost?.shadowRoot;
    const memoBar = memoRoot?.querySelector('.bar');
    const memoButtons = memoRoot ? [...memoRoot.querySelectorAll('.bar button.tool')] : [];
    if (memoBar && memoButtons.length) {
      const legacy = [...selectedIDs].filter(id => /^memo:(?:add|list|search|sync|\d+)$/.test(id));
      if (legacy.length) {
        legacy.forEach(id => selectedIDs.delete(id));
        selectedIDs.add('memo:main');
        persistSelection();
      }
      const names = { add: '추가', list: '목록', search: '검색', sync: '동기화' };
      const icons = { add: '＋', list: '🗒️', search: '🔍', sync: '🔄' };
      const children = memoButtons.map((button, index) => {
        const view = button.getAttribute('data-view') || String(index);
        const label = names[view] || cleanText(button.textContent) || '메모';
        return {
          id: `memo-child:${view}`,
          label,
          icon: icons[view] || iconFor(label, '🗒️'),
          // 메모 바는 자체 pointerdown 드래그를 처리한다. 주머니에서 포인터를
          // 전달한 뒤 click까지 호출하면 모바일 Safari에서 드래그 상태가 남을
          // 수 있으므로 메모 하위 기능은 단일 click 이벤트로만 실행한다.
          forwardPress: false,
          run: () => {
            const current = d.getElementById('zk_memo_dock')?.shadowRoot
              ?.querySelector(`.bar button.tool[data-view="${view}"]`);
            if (!current) return false;
            current.dispatchEvent(new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              composed: true,
              view: w,
            }));
            return true;
          },
        };
      });
      registerElement(memoButtons[0], {
        id: 'memo:main',
        label: '메모',
        icon: '🗒️',
        group: '도구',
        order: 40,
        hideTarget: memoBar,
        children,
        run: () => {},
      });
    }

    const gameRoot = d.getElementById('zk-chat-games-root')?.shadowRoot;
    if (gameRoot) watchCandidateDragRoot(gameRoot);
    const launcher = gameRoot?.querySelector('.launcher')
      || gameRoot?.querySelector('button[aria-label*="Zetendo" i],button[aria-label*="젯텐도"]');
    if (launcher) {
      const zetendoID = 'known:zetendo';
      const gameShell = launcher.closest('.shell') || launcher;
      registerElement(launcher, {
        id: zetendoID,
        label: '젯텐도',
        icon: '🎮',
        order: 50,
        hideTarget: gameShell,
        run: () => {
          const currentRoot = d.getElementById('zk-chat-games-root')?.shadowRoot;
          const current = currentRoot?.querySelector('.launcher')
            || currentRoot?.querySelector('button[aria-label*="Zetendo" i],button[aria-label*="젯텐도"]');
          if (!current) return false;
          const invoke = () => { current.click(); return true; };
          if (selectedIDs.has(zetendoID)) {
            return runSelectedToggle(zetendoID, invoke, () => current.closest('.shell')?.classList.contains('open') || false);
          }
          return invoke();
        },
      });
    }
  }

  function scanBridgedTools() {
    d.querySelectorAll(`[${BRIDGE_TOOLS_ATTR}]`).forEach(host => {
      if (!(host instanceof HTMLElement)) return;
      let info = null;
      try { info = JSON.parse(host.getAttribute(BRIDGE_TOOLS_ATTR) || 'null'); } catch (_) {}
      if (!info || !Array.isArray(info.tools) || !info.tools.length) return;
      const isAutoKiller = /^zk-tm-unified-panel/i.test(host.id);
      // 열린 루트와 이 실행본이 생성 순간에 잡은 루트는 내부 구조를 직접 읽는다.
      // 브리지 목록까지 함께 등록하면 숨겨진 설정 모달의 버튼이 전부 별도 기능으로 중복된다.
      if (shadowRootOf(host)) return;
      let tools = info.tools.map((tool, index) => ({
        key: cleanText(tool.key) || String(index),
        index: Number.isFinite(tool.index) ? tool.index : index,
        label: friendlyToolName(tool.label || tool.key || `도구 ${index + 1}`),
      }));
      if (isAutoKiller) {
        tools = AUTO_KILLER_TOOLS.map(spec => {
          const found = tools.find(tool => spec.matches(cleanText(tool.label)));
          return found ? { ...found, label: spec.label, icon: spec.icon, actionKey: spec.key } : null;
        }).filter(Boolean);
      }
      if (!tools.length) return;
      const totals = tools.reduce((map, tool) => map.set(tool.label, (map.get(tool.label) || 0) + 1), new Map());
      const occurrences = new Map();
      tools = tools.map(tool => {
        if ((totals.get(tool.label) || 0) === 1) return tool;
        const count = (occurrences.get(tool.label) || 0) + 1;
        occurrences.set(tool.label, count);
        return { ...tool, label: `${tool.label} ${count}` };
      });
      const bridgeID = host.getAttribute(BRIDGE_ID_ATTR) || host.id || 'shadow-tool';
      const id = isAutoKiller ? 'bridge:auto-killer' : `bridge:${bridgeID}`;
      if (isAutoKiller) migrateSelection(['known:auto-killer'], id);
      const label = isAutoKiller
        ? 'AUTO_KILLER'
        : friendlyToolName(cleanText(info.label).slice(0, 48) || accessibleName(host, 'Shadow 도구'));
      const children = tools.map(tool => ({
        id: `${id}:child:${tool.actionKey || tool.key}`,
        label: tool.label,
        icon: tool.icon || iconFor(tool.label),
        stateRead: () => {
          const current = [...d.querySelectorAll(`[${BRIDGE_ID_ATTR}]`)]
            .find(element => element.getAttribute(BRIDGE_ID_ATTR) === bridgeID);
          if (!current) return null;
          try {
            const latest = JSON.parse(current.getAttribute(BRIDGE_TOOLS_ATTR) || 'null');
            const latestTools = Array.isArray(latest?.tools) ? latest.tools : [];
            return (latestTools.find((item, index) => cleanText(item.key) === tool.key || index === tool.index) || {}).status || null;
          } catch (_) { return null; }
        },
        pressStart: sourceEvent => {
          const current = [...d.querySelectorAll(`[${BRIDGE_ID_ATTR}]`)]
            .find(element => element.getAttribute(BRIDGE_ID_ATTR) === bridgeID);
          if (!current) return false;
          current.dispatchEvent(new CustomEvent(BRIDGE_ACTION_EVENT, {
            bubbles: true,
            detail: JSON.stringify({ key: tool.key, index: tool.index, phase: 'down', pointerId: sourceEvent?.pointerId, pointerType: sourceEvent?.pointerType, clientX: sourceEvent?.clientX, clientY: sourceEvent?.clientY }),
          }));
          return true;
        },
        pressEnd: (sourceEvent, cancelled) => {
          const current = [...d.querySelectorAll(`[${BRIDGE_ID_ATTR}]`)]
            .find(element => element.getAttribute(BRIDGE_ID_ATTR) === bridgeID);
          if (!current) return;
          current.dispatchEvent(new CustomEvent(BRIDGE_ACTION_EVENT, {
            bubbles: true,
            detail: JSON.stringify({ key: tool.key, index: tool.index, phase: cancelled ? 'cancel' : 'up', pointerId: sourceEvent?.pointerId, pointerType: sourceEvent?.pointerType, clientX: sourceEvent?.clientX, clientY: sourceEvent?.clientY }),
          }));
        },
        run: () => {
          const current = [...d.querySelectorAll(`[${BRIDGE_ID_ATTR}]`)]
            .find(element => element.getAttribute(BRIDGE_ID_ATTR) === bridgeID);
          if (!current) return false;
          if (isAutoKiller && tool.actionKey === 'settings' && selectedIDs.has(id)) {
            return runSelectedToggle(id, () => {
              current.dispatchEvent(new CustomEvent(BRIDGE_ACTION_EVENT, {
                bubbles: true,
                detail: JSON.stringify({ key: tool.key, index: tool.index }),
              }));
              return true;
            }, () => {
              const latestHost = [...d.querySelectorAll(`[${BRIDGE_ID_ATTR}]`)]
                .find(element => element.getAttribute(BRIDGE_ID_ATTR) === bridgeID);
              if (!latestHost) return false;
              try {
                const latest = JSON.parse(latestHost.getAttribute(BRIDGE_TOOLS_ATTR) || 'null');
                const latestTool = (latest?.tools || []).find((item, index) => cleanText(item.key) === tool.key || index === tool.index);
                const state = normalizedRunState(latestTool?.status);
                return state === 'running' ? true : state === 'cancelled' ? false : null;
              } catch (_) { return null; }
            });
          }
          current.dispatchEvent(new CustomEvent(BRIDGE_ACTION_EVENT, {
            bubbles: true,
            detail: JSON.stringify({ key: tool.key, index: tool.index }),
          }));
          return true;
        },
      }));
      registerElement(host, {
        id,
        label,
        icon: isAutoKiller ? '☠️' : iconFor(label, '🧰'),
        group: '도구',
        order: isAutoKiller ? 15 : 65,
        hideTarget: host,
        children,
        run: () => {},
      });
    });
  }

  function toolbarButtons(container, includeHidden = false) {
    const seen = new Set();
    return [...(container?.querySelectorAll?.(TOOL_CONTROL_SELECTOR) || [])].filter(element => {
      const target = clickable(element);
      if (!target || seen.has(target) || !target.isConnected || (!includeHidden && !visible(target))) return false;
      seen.add(target);
      return true;
    });
  }

  function toolbarMarker(container) {
    return [
      container.id,
      typeof container.className === 'string' ? container.className : '',
      container.getAttribute?.('role'),
      container.getAttribute?.('aria-label'),
      container.getAttribute?.('title'),
      ...Object.keys(container.dataset || {}),
    ].filter(Boolean).join(' ');
  }

  function toolbarToolKey(element, index = 0) {
    const value = [
      element?.getAttribute?.('data-action'), element?.getAttribute?.('data-view'),
      element?.getAttribute?.('data-testid'), element?.id,
      element?.getAttribute?.('aria-label'), element?.getAttribute?.('title'),
      element?.getAttribute?.('name'), accessibleName(element, ''),
    ].map(humanizeToken).find(Boolean);
    return value ? value.toLowerCase() : `index:${index}`;
  }

  function findToolbarGroup(element) {
    let container = element?.parentElement;
    for (let depth = 0; container && depth < 6; depth += 1, container = container.parentElement) {
      if (container.id === HOST_ID || container.closest?.('#__inpocket_root__')) return null;
      if (container.getRootNode?.() instanceof ShadowRoot && container.getRootNode().host?.id === 'zk_memo_dock') return null;
      const marker = toolbarMarker(container);
      const named = /(toolbar|tool[-_ ]?bar|tab[-_ ]?bar|dock|toolbox|palette|review|검토|memo|메모|zetakit|zeta[-_].*tool|floating[-_ ]?tools?)/i.test(marker);
      const tools = toolbarButtons(container, named);
      if (tools.length < 2 || tools.length > 24) continue;
      const rect = container.getBoundingClientRect();
      const style = getComputedStyle(container);
      const zIndex = Number.parseInt(style.zIndex, 10) || 0;
      const floating = ['fixed', 'absolute', 'sticky'].includes(style.position) && zIndex >= 100;
      const compact = rect.width > 0 && rect.height > 0
        && rect.width <= Math.min(760, Math.max(120, w.innerWidth - 8))
        && rect.height <= Math.min(520, Math.max(120, w.innerHeight - 8))
        && rect.width * rect.height <= 280000;
      if (compact && (named || floating)) return { container, tools };
    }
    return null;
  }

  function automaticToolbarLabel(container, labels) {
    const root = container.getRootNode?.();
    const host = root instanceof ShadowRoot ? root.host : null;
    const explicit = cleanText(
      container.getAttribute?.('aria-label') ||
      container.getAttribute?.('title') ||
      container.dataset?.toolName ||
      container.dataset?.toolbarName ||
      host?.getAttribute?.('aria-label') ||
      host?.getAttribute?.('title') ||
      host?.dataset?.toolName ||
      host?.dataset?.toolbarName || ''
    );
    if (explicit && explicit.length <= 34) return explicit;
    const marker = toolbarMarker(container).toLowerCase();
    if (/review|검토/.test(marker)) return '응답 검토';
    if (/memo|메모/.test(marker)) return '메모';
    if (/studio|튜디오/.test(marker)) return '젯튜디오';
    const hostName = humanizeToken(host?.id || '');
    if (hostName && hostName.length <= 34 && !/^(?:root|app|host|container|shadow)$/i.test(hostName)) return hostName;
    const first = labels[0] || '도구';
    return labels.length > 1 ? `${first} 외 ${labels.length - 1}개` : `${first} 도구`;
  }

  function automaticToolbarID(container, label, labels) {
    const root = container.getRootNode?.();
    const rootName = root instanceof ShadowRoot ? root.host?.id || root.host?.tagName || 'shadow' : 'page';
    const signature = [rootName, container.id, typeof container.className === 'string' ? container.className : '', container.getAttribute?.('aria-label'), label, ...labels].filter(Boolean).join('|');
    let hash = 2166136261;
    for (let index = 0; index < signature.length; index += 1) hash = Math.imul(hash ^ signature.charCodeAt(index), 16777619);
    return `toolbar:auto:${(hash >>> 0).toString(36)}`;
  }

  function scanToolbarGroups() {
    const groups = new Map();
    allRoots().forEach(root => {
      if (root instanceof ShadowRoot) {
        watchCandidateDragRoot(root);
        watchToolRoot(root);
      }
      root.querySelectorAll?.(TOOL_CONTROL_SELECTOR).forEach(element => {
        if (element.closest?.(`#${HOST_ID}`)) return;
        const found = findToolbarGroup(element);
        if (found && !groups.has(found.container)) groups.set(found.container, found.tools);
      });
    });

    groups.forEach((tools, container) => {
      const existingGroupID = elementActions.get(container);
      if (existingGroupID && !existingGroupID.startsWith('toolbar:auto:')) {
        tools.forEach(tool => groupedToolbarElements.add(tool));
        return;
      }
      const protectedToolIDs = [...new Set(tools.map(tool => elementActions.get(tool)).filter(toolID =>
        toolID && !toolID.startsWith('element:') && !toolID.startsWith('toolbar:auto:')
      ))];
      const containerRoot = container.getRootNode?.();
      if (containerRoot instanceof ShadowRoot) {
        watchCandidateDragRoot(containerRoot);
        watchToolRoot(containerRoot);
      }
      const rawLabels = tools.map(tool => displayControlName(tool, '도구'));
      const totals = rawLabels.reduce((map, name) => map.set(name, (map.get(name) || 0) + 1), new Map());
      const occurrences = new Map();
      const labels = rawLabels.map((name, index) => {
        if ((totals.get(name) || 0) === 1 && name !== '도구') return name;
        const count = (occurrences.get(name) || 0) + 1;
        occurrences.set(name, count);
        return `${name || '도구'} ${count || index + 1}`;
      });
      const toolKeys = tools.map((tool, index) => toolbarToolKey(tool, index));
      const label = automaticToolbarLabel(container, labels);
      const id = existingGroupID || automaticToolbarID(container, label, labels);
      if (protectedToolIDs.length) {
        if (selectedIDs.has(id) || container.getAttribute(MANAGED_ATTR) === '1') {
          selectedIDs.delete(id);
          actions.delete(id);
          candidates.delete(id);
          restoreTarget(container);
          restoreHandoffTarget(container);
          protectedToolIDs.forEach(toolID => {
            selectedIDs.add(toolID);
            activateCandidate(toolID);
          });
          persistSelection();
        }
        return;
      }
      const legacyIDs = [...new Set(tools.map(tool => elementActions.get(tool)).filter(Boolean))].filter(legacyID => legacyID !== id);
      const migrateSelection = legacyIDs.some(legacyID => selectedIDs.has(legacyID));
      legacyIDs.forEach(legacyID => {
        const legacy = candidates.get(legacyID);
        if (legacy?.hideTarget) restoreTarget(legacy.hideTarget);
        selectedIDs.delete(legacyID);
        actions.delete(legacyID);
        candidates.delete(legacyID);
      });
      if (migrateSelection) {
        selectedIDs.add(id);
        persistSelection();
      }
      const children = labels.map((childLabel, index) => ({
        id: `${id}:child:${index}`,
        label: childLabel,
        icon: iconFor(childLabel),
        pressTarget: () => {
          scanTools(true);
          const current = candidates.get(id)?.element;
          const currentTools = toolbarButtons(current, true);
          return currentTools.find((button, currentIndex) => toolbarToolKey(button, currentIndex) === toolKeys[index])
            || currentTools[index] || null;
        },
        run: () => {
          scanTools(true);
          const current = candidates.get(id)?.element;
          const currentTools = toolbarButtons(current, true);
          const target = currentTools.find((button, currentIndex) => toolbarToolKey(button, currentIndex) === toolKeys[index])
            || currentTools[index];
          if (!target) return false;
          target.click();
          return true;
        },
      }));
      registerElement(container, {
        id,
        label,
        icon: iconFor(label, '🧰'),
        group: '도구',
        order: 60,
        hideTarget: container,
        children,
        run: () => {},
      });
      tools.forEach(tool => groupedToolbarElements.add(tool));
    });
  }

  function draggedCandidateID(element, overrides = {}) {
    const root = element?.getRootNode?.();
    const rootName = root instanceof ShadowRoot
      ? [root.host?.id, root.host?.className, root.host?.tagName].filter(Boolean).join('.')
      : 'page';
    const segments = [];
    for (let current = element, depth = 0; current instanceof HTMLElement && depth < 6; current = current.parentElement, depth += 1) {
      const parent = current.parentElement;
      const siblings = parent ? [...parent.children].filter(child => child.tagName === current.tagName) : [];
      const index = siblings.length > 1 ? siblings.indexOf(current) + 1 : 0;
      segments.push([
        current.tagName,
        current.id,
        typeof current.className === 'string' ? current.className : '',
        current === element && overrides.ariaLabel !== undefined ? overrides.ariaLabel : current.getAttribute('aria-label'),
        current === element && overrides.title !== undefined ? overrides.title : current.getAttribute('title'),
        index || '',
      ].filter(Boolean).join('.'));
    }
    const signature = [rootName, ...segments].join('|');
    let hash = 2166136261;
    for (let index = 0; index < signature.length; index += 1) hash = Math.imul(hash ^ signature.charCodeAt(index), 16777619);
    return `dragged:${(hash >>> 0).toString(36)}`;
  }

  function scanFloatingShadowHosts() {
    allRoots().forEach(root => {
      if (!(root instanceof ShadowRoot)) return;
      const host = root.host;
      if (!(host instanceof HTMLElement) || host.id === HOST_ID || host.closest?.(`#${HOST_ID}`)) return;
      const style = getComputedStyle(host);
      const rect = host.getBoundingClientRect();
      const zIndex = Number.parseInt(style.zIndex, 10) || 0;
      if (!['fixed', 'absolute', 'sticky'].includes(style.position) || zIndex < 1000) return;
      if (rect.width < 12 || rect.height < 12 || rect.width > 160 || rect.height > 160) return;
      const launcher = [...root.querySelectorAll('button,[role="button"],a,[tabindex]')]
        .find(element => visible(element) && !element.hasAttribute(BOOKMARKLET_LAUNCHER_ATTR));
      if (!launcher) return;
      const existingID = elementActions.get(launcher);
      if (existingID && !existingID.startsWith('dragged:') && !existingID.startsWith('floating:')) return;
      const stableName = cleanText(
        host.id || host.getAttribute('data-testid') || host.getAttribute('data-name') || host.getAttribute('aria-label')
      ).toLowerCase().replace(/[^0-9a-z가-힣_-]+/g, '-').replace(/^-|-$/g, '');
      const id = stableName ? `floating:${stableName}` : draggedCandidateID(launcher);
      const legacyIDs = [draggedCandidateID(launcher)];
      if (host.id === 'zk-reading-host') {
        // v1.1.35가 Reading의 열린 설정 모달을 브리지 도구로 잘못 저장한 ID를
        // 실제 플로팅 실행 버튼 하나로 자동 이전한다.
        legacyIDs.push('bridge:host:zk-reading-host', 'bridge:zk-reading-host');
        ['Reading: ON', 'Reading: OFF', 'Reading 생성·교체 중', 'Reading 완료', 'Reading 오류'].forEach(label => {
          legacyIDs.push(draggedCandidateID(launcher, {
            ariaLabel: label,
            title: `${label} · 짧게 눌러 ON/OFF, 길게 눌러 설정`,
          }));
        });
      }
      const capturedID = savedIDForLauncher(launcher);
      if (capturedID && capturedID !== id) migrateSelection([capturedID], id);
      migrateSelection(legacyIDs, id);
      const rawLabel = accessibleName(launcher, accessibleName(host, '플로팅 도구'));
      const label = host.id === 'zk-reading-host'
        ? 'Reading'
        : cleanText(rawLabel).replace(/\s*:\s*(?:ON|OFF)$/i, '') || '플로팅 도구';
      const isReading = host.id === 'zk-reading-host';
      const readingSource = isReading ? {
        element: launcher,
        pressTarget: () => d.getElementById('zk-reading-host')?.shadowRoot?.querySelector('.fab') || launcher,
      } : null;
      const children = isReading ? [
        {
          id: `${id}:short-press`,
          label: '실행 / 실행 취소',
          icon: '▶︎',
          forwardPress: false,
          stateRead: () => {
            const fab = d.getElementById('zk-reading-host')?.shadowRoot?.querySelector('.fab');
            return fab ? { pressed: fab.getAttribute('aria-pressed'), phase: fab.getAttribute('data-phase'), label: fab.getAttribute('aria-label') } : null;
          },
          run: () => runSyntheticShortPress(readingSource),
        },
        {
          id: `${id}:long-press`,
          label: '설정',
          icon: '⚙️',
          forwardPress: false,
          run: () => runSelectedToggle(id, async () => {
            const worked = await runSyntheticLongPress(readingSource);
            const currentRoot = d.getElementById('zk-reading-host')?.shadowRoot;
            if (currentRoot) hidePocketWhileExternalOverlayIsOpen(currentRoot);
            return worked;
          }, () => {
            const modal = d.getElementById('zk-reading-host')?.shadowRoot?.querySelector('[data-modal]');
            return Boolean(modal?.classList.contains('on') && visible(modal));
          }),
        },
      ] : undefined;
      registerElement(launcher, {
        id,
        label,
        icon: iconFor(label),
        group: '기타',
        order: 900,
        hideTarget: host,
        children,
      });
    });
  }

  function scanGenericTools() {
    scanToolbarGroups();
    scanFloatingShadowHosts();
    allRoots().forEach(root => {
      if (root instanceof ShadowRoot) {
        watchCandidateDragRoot(root);
        watchToolRoot(root);
      }
      root.querySelectorAll?.(TOOL_CONTROL_SELECTOR).forEach(element => {
        if (groupedToolbarElements.has(element) || elementActions.has(element) || element.closest?.(`#${HOST_ID}`) || element.hasAttribute(BOOKMARKLET_LAUNCHER_ATTR)) return;
        const savedDraggedID = draggedCandidateID(element);
        const marker = [
          element.id,
          typeof element.className === 'string' ? element.className : '',
          element.getAttribute('aria-label'),
          element.getAttribute('title'),
          element.getAttribute('data-inpocket'),
        ].filter(Boolean).join(' ');
        const recognized = /(zetakit|zeta[-_].*(?:float|launcher|tool)|zet[-_]?studio|젯튜디오|inpocket|userscript|zk[-_].*(?:fab|launcher))/i.test(marker);
        const capturedID = savedIDForLauncher(element);
        if (!recognized && !selectedIDs.has(savedDraggedID) && !capturedID) return;
        const carrier = visualCarrierForElement(element);
        const style = getComputedStyle(carrier);
        const rect = carrier.getBoundingClientRect();
        const zIndex = Number.parseInt(style.zIndex, 10) || 0;
        if (style.position !== 'fixed' || zIndex < 1000 || rect.width <= 0 || rect.height <= 0 || rect.width > 100 || rect.height > 100) return;
        const label = accessibleName(element, '추가 도구');
        registerElement(element, {
          id: capturedID || (selectedIDs.has(savedDraggedID) ? savedDraggedID : undefined),
          label,
          icon: iconFor(label),
          group: '기타',
          order: 900,
          hideTarget: carrier,
        });
      });
    });
  }

  function removeStaleActions() {
    let changed = false;
    for (const [root, observer] of toolRootObservers) {
      if (root.host?.isConnected) continue;
      observer.disconnect();
      toolRootObservers.delete(root);
    }
    for (const [element, id] of elementActions) {
      if (element.isConnected) continue;
      elementActions.delete(element);
      const candidate = candidates.get(id);
      if (candidate?.element === element) candidates.delete(id);
      changed = actions.delete(id) || changed;
      hiddenTargets.delete(element);
    }
    for (const target of hiddenTargets.keys()) if (!target.isConnected) hiddenTargets.delete(target);
    return changed;
  }

  function scanTools(includeGeneric = true) {
    const changed = removeStaleActions();
    syncThemeColor();
    scanKnownTools();
    scanShadowTools();
    scanBridgedTools();
    if (includeGeneric) scanGenericTools();
    if (changed) pocket?.render?.();
  }

  function createPocket() {
    d.getElementById(HOST_ID)?.remove();
    const host = d.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host{all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color-scheme:light}
        *{box-sizing:border-box}
        button{font:inherit;-webkit-tap-highlight-color:transparent}
        .scrim{position:fixed;inset:0;border:0;background:rgba(0,0,0,.24);opacity:0;pointer-events:none;transition:opacity .18s ease}
        .launcher{position:fixed;display:grid;place-items:center;width:42px;height:42px;padding:0;border:0;background:transparent;color:#fff;filter:drop-shadow(0 5px 5px rgba(0,0,0,.3));pointer-events:auto;touch-action:none;cursor:grab;transition:transform .16s ease,opacity .16s ease,filter .16s ease}
        .launcher:active{transform:scale(.94);filter:drop-shadow(0 5px 7px rgba(0,0,0,.26))}
        .folder{width:33px;height:30px;display:block;overflow:visible}
        .folder-docs{opacity:0;transform:translateY(6px);transform-origin:center;transition:opacity .18s ease,transform .18s ease}
        :host(.has-items) .folder-docs{opacity:1;transform:none}
        :host(.drop-ready) .launcher{filter:drop-shadow(0 0 9px rgba(116,200,255,.8)) drop-shadow(0 8px 9px rgba(0,0,0,.28))}
        :host(.drop-hover) .launcher{transform:scale(1.12);filter:drop-shadow(0 0 13px rgba(116,200,255,1)) drop-shadow(0 8px 9px rgba(0,0,0,.28))}
        .panel{position:fixed;width:min(346px,calc(100vw - 24px));max-height:min(590px,calc(100dvh - 84px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(24,24,29,.96);color:#f7f7f9;box-shadow:0 22px 64px rgba(0,0,0,.48);backdrop-filter:blur(24px) saturate(1.25);-webkit-backdrop-filter:blur(24px) saturate(1.25);opacity:0;transform:translateY(8px) scale(.98);pointer-events:none;transition:opacity .17s ease,transform .17s ease}
        :host(.editor-open) .panel{height:min(560px,calc(100dvh - 20px));max-height:calc(100dvh - 20px)}
        .head{display:flex;align-items:center;gap:10px;padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,.08);touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
        :host(.panel-dragging) .head{cursor:grabbing}
        .mark{display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;border-radius:12px;background:linear-gradient(145deg,#8064ff,#5034c8);font-size:17px;box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
        .titles{min-width:0;flex:1}.title-row{display:flex;align-items:center;gap:6px;min-width:0}.title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:800;line-height:1.2}.version{flex:0 0 auto;padding:2px 5px;border-radius:6px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.58);font-size:8px;font-weight:800;line-height:1}.subtitle{margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(255,255,255,.52);font-size:10px;font-weight:600}
        .manage,.rename,.add{flex:0 0 auto;height:30px;padding:0 9px;border:0;border-radius:9px;font-size:10px;font-weight:800;white-space:nowrap;cursor:pointer}.manage{background:rgba(124,92,255,.14);color:#a99aff}.rename,.add{background:rgba(255,255,255,.07);color:rgba(255,255,255,.78)}.add{display:grid;place-items:center;width:30px;padding:0;font-size:18px;line-height:1}.close{display:grid;place-items:center;flex:0 0 30px;width:30px;height:30px;border:0;border-radius:10px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.74);font-size:18px;cursor:pointer}
        .scroll{min-height:0;overflow:auto;padding:12px 12px max(14px,env(safe-area-inset-bottom));overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
        .section+.section{margin-top:15px}.section-title{display:flex;align-items:center;justify-content:space-between;margin:0 4px 8px;color:rgba(255,255,255,.48);font-size:10px;font-weight:800;letter-spacing:.07em}.section-count{font-variant-numeric:tabular-nums}
        .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
        .tool-wrap{position:relative;min-width:0}.tool{width:100%;min-width:0;min-height:74px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:9px 5px;border:1px solid rgba(255,255,255,.075);border-radius:15px;background:rgba(255,255,255,.055);color:#f7f7f9;cursor:pointer;transition:background .13s ease,transform .13s ease,border-color .13s ease,opacity .13s ease}
        .tool:active{transform:scale(.96);background:rgba(124,92,255,.2);border-color:rgba(145,120,255,.38)}
        .tool-icon{font-size:21px;line-height:1}.tool-label{display:block;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-size:10px;font-weight:720;line-height:1.25}
        .remove{position:absolute;right:-4px;top:-5px;display:none;place-items:center;width:23px;height:23px;padding:0;border:2px solid #18181d;border-radius:999px;background:#ff5c67;color:#fff;font-size:16px;font-weight:800;line-height:1;box-shadow:0 3px 8px rgba(0,0,0,.28);cursor:pointer}
        :host(.managing) .tool{opacity:.62}:host(.managing) .tool-wrap.removable .remove{display:grid}:host(.renaming) .tool{border-color:rgba(145,120,255,.46);background:rgba(124,92,255,.13)}
        .subnav{display:flex;align-items:center;gap:8px;width:100%;margin:0 0 12px;padding:9px 11px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(255,255,255,.05);color:#f7f7f9;font-size:11px;font-weight:800;text-align:left;cursor:pointer}.subnav span{color:rgba(255,255,255,.52);font-size:17px;line-height:1}
        .editor[hidden]{display:none!important}.editor{position:absolute;inset:0;z-index:5;display:grid;place-items:center;padding:18px;background:rgba(10,10,13,.72);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}.editor-card{width:min(286px,100%);max-height:calc(100% - 8px);overflow:auto;padding:17px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:#25252b;box-shadow:0 18px 46px rgba(0,0,0,.4)}.editor-title{margin-bottom:14px;font-size:14px;font-weight:850}.editor-row{display:grid;grid-template-columns:66px 1fr;align-items:center;gap:9px;margin-top:9px;color:rgba(255,255,255,.66);font-size:10px;font-weight:750}.editor input,.editor textarea{min-width:0;width:100%;padding:0 11px;border:1px solid rgba(255,255,255,.12);border-radius:10px;outline:0;background:rgba(255,255,255,.07);color:#fff;font:700 13px/1.35 inherit}.editor input{height:38px}.editor textarea{height:138px;padding:10px;resize:vertical;font-size:10px}.editor input:focus,.editor textarea:focus{border-color:rgba(145,120,255,.72);box-shadow:0 0 0 3px rgba(124,92,255,.14)}.editor-help{margin-top:9px;color:rgba(255,255,255,.48);font-size:9px;line-height:1.45}.editor-sync{display:flex;gap:7px;margin-top:11px}.editor-sync button{flex:1;height:32px;border:0;border-radius:9px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.72);font-size:9px;font-weight:800}.editor-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:15px}.editor-actions button{height:34px;padding:0 11px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;font-size:10px;font-weight:800;cursor:pointer}.editor-actions .editor-save{background:#6850df}.editor-actions .editor-reset{margin-right:auto;color:rgba(255,255,255,.62)}
        .empty{padding:30px 15px;text-align:center;color:rgba(255,255,255,.5);font-size:12px;line-height:1.6}
        .toast{position:fixed;left:50%;bottom:max(20px,env(safe-area-inset-bottom));max-width:calc(100vw - 32px);padding:10px 14px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(25,25,30,.94);color:#fff;font-size:11px;font-weight:700;white-space:nowrap;opacity:0;transform:translate(-50%,8px);transition:opacity .18s ease,transform .18s ease;pointer-events:none}
        :host(.open) .scrim{opacity:1;pointer-events:auto}:host(.open) .panel{opacity:1;transform:none;pointer-events:auto}:host(.open) .launcher{opacity:0;pointer-events:none}
        :host(.keyboard) .launcher,:host(.keyboard) .panel,:host(.keyboard) .scrim,:host(.external-tool-open) .launcher{opacity:0!important;pointer-events:none!important}
        @media(max-width:390px){.panel{width:calc(100vw - 20px);border-radius:22px}.head{gap:8px;padding:14px 13px 11px}.grid{gap:6px}.tool{min-height:70px}}
        @media(max-width:300px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.subtitle{display:none}}
        @media(prefers-reduced-motion:reduce){*{transition:none!important}}

        /* Toolbox White UI: visuals only; keep Pocket capture engine intact */
        .scrim{background:rgba(32,54,34,.18)}
        .panel{background:#fff;color:#263a2a;border:1px solid #dce8da;box-shadow:0 18px 54px rgba(25,55,30,.18);backdrop-filter:none;-webkit-backdrop-filter:none}
        .head{background:#fff;border-bottom-color:#e7eee5}
        .mark{background:#e5f2e0;color:#5c8d56;box-shadow:none}
        .title{color:#263a2a}.version{background:#edf4eb;color:#7b9579}.subtitle{color:#829781}
        .manage{background:#e5f2e0;color:#547d50}
        .rename,.add,.close{background:#f0f5ee;color:#567151}
        .section-title{color:#819680}
        .tool{background:#fff;color:#314633;border-color:#e3ebe0;box-shadow:0 2px 8px rgba(34,61,38,.055)}
        .tool:active{background:#eaf5e7;border-color:#b7d0b1}
        .tool-label{color:#314633}
        .remove{border-color:#fff}
        :host(.renaming) .tool{background:#f0f8ed;border-color:#a9cba1}
        .subnav{background:#f7faf5;color:#314633;border-color:#e2ebe0}.subnav span{color:#829781}
        .editor{background:rgba(29,53,33,.25);backdrop-filter:blur(5px)}
        .editor-card{background:#fff;border-color:#dce7da;box-shadow:0 18px 46px rgba(34,61,38,.2)}
        .editor-title{color:#314633}.editor-row,.editor-help{color:#6d866c}
        .editor input,.editor textarea{background:#f9fbf8;color:#314633;border-color:#dce7da}
        .editor input:focus,.editor textarea:focus{border-color:#8db68a;box-shadow:0 0 0 3px #cce6c8}
        .editor-sync button,.editor-actions button{background:#eef5eb;color:#50724e}
        .editor-actions .editor-save{background:#628d5b;color:#fff}
        .editor-actions .editor-reset{color:#7d9079}
        .empty{color:#899b85}.toast{background:#344b38;color:#fff;border-color:#46624a}
      </style>
      <button class="scrim" type="button" aria-label="주머니 닫기"></button>
      <section class="panel" role="dialog" aria-modal="true" aria-label="도구 주머니" aria-hidden="true">
        <header class="head"><div class="mark">✦</div><div class="titles"><div class="title-row"><div class="title">Toolbox</div><span class="version">v${VERSION}</span></div><div class="subtitle">도구를 한곳에 깔끔하게</div></div><button class="manage" type="button">정리</button><button class="rename" type="button">이름 바꾸기</button><button class="add" type="button" aria-label="북마클릿 직접 추가" title="북마클릿 직접 추가">＋</button><button class="close" type="button" aria-label="닫기">×</button></header>
        <div class="scroll"></div>
        <form class="editor rename-editor" hidden><div class="editor-card"><div class="editor-title">이름과 아이콘 바꾸기</div><label class="editor-row"><span>이름</span><input class="editor-name" type="text" maxlength="32" autocomplete="off"></label><label class="editor-row"><span>아이콘</span><input class="editor-icon" type="text" maxlength="12" autocomplete="off" inputmode="text"></label><div class="editor-actions"><button class="editor-reset" type="button">기본값</button><button class="editor-cancel" type="button">취소</button><button class="editor-save" type="submit">저장</button></div></div></form>
        <form class="editor bookmarklet-editor" hidden><div class="editor-card"><div class="editor-title">북마클릿 직접 추가</div><label class="editor-row"><span>이름</span><input class="bookmarklet-name" type="text" maxlength="32" autocomplete="off"></label><label class="editor-row"><span>아이콘</span><input class="bookmarklet-icon" type="text" maxlength="12" autocomplete="off" value="🔖"></label><label class="editor-row"><span>코드</span><textarea class="bookmarklet-code" spellcheck="false" placeholder="javascript:로 시작하는 코드를 붙여넣으세요"></textarea></label><div class="editor-help">새 플로팅 아이콘을 만드는 북마클릿은 아이콘까지 자동으로 눌러 열고, 바깥 아이콘은 주머니 안에 숨깁니다.</div><div class="editor-sync"><button class="bookmarklet-backup" type="button">백업 복사</button><button class="bookmarklet-restore" type="button">백업 불러오기</button></div><div class="editor-actions"><button class="bookmarklet-cancel" type="button">취소</button><button class="editor-save" type="submit">추가</button></div></div></form>
      </section>
      <button class="launcher" type="button" aria-label="빈 도구 주머니 열기" aria-expanded="false">
        <svg class="folder" viewBox="0 0 64 56" aria-hidden="true">
          <defs><linearGradient id="zfp-back" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#82d7ff"/><stop offset="1" stop-color="#319ce7"/></linearGradient><linearGradient id="zfp-front" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#65c8fa"/><stop offset="1" stop-color="#2a92dc"/></linearGradient><linearGradient id="zfp-paper" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#dceaf3"/></linearGradient></defs>
          <path d="M4 13.5A5.5 5.5 0 0 1 9.5 8h14l5 5H55a5 5 0 0 1 5 5v27a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V13.5Z" fill="url(#zfp-back)"/>
          <g class="folder-docs"><rect x="11" y="12" width="42" height="25" rx="3" fill="url(#zfp-paper)"/><path d="M16 18h25M16 23h31M16 28h21" stroke="#a9bfcc" stroke-width="1.7" stroke-linecap="round"/></g>
          <path d="M4 22a5 5 0 0 1 5-5h46a5 5 0 0 1 5 5v24a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V22Z" fill="url(#zfp-front)"/>
          <path d="M8 20.5h48" stroke="rgba(255,255,255,.55)" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="toast" role="status" aria-live="polite"></div>
    `;
    d.documentElement.appendChild(host);

    const launcher = shadow.querySelector('.launcher');
    const panel = shadow.querySelector('.panel');
    const head = shadow.querySelector('.head');
    const scroll = shadow.querySelector('.scroll');
    const manageButton = shadow.querySelector('.manage');
    const renameButton = shadow.querySelector('.rename');
    const addButton = shadow.querySelector('.add');
    const editor = shadow.querySelector('.rename-editor');
    const editorTitle = shadow.querySelector('.editor-title');
    const editorName = shadow.querySelector('.editor-name');
    const editorIcon = shadow.querySelector('.editor-icon');
    const bookmarkletEditor = shadow.querySelector('.bookmarklet-editor');
    const bookmarkletName = shadow.querySelector('.bookmarklet-name');
    const bookmarkletIcon = shadow.querySelector('.bookmarklet-icon');
    const bookmarkletCode = shadow.querySelector('.bookmarklet-code');
    const toastNode = shadow.querySelector('.toast');
    let open = false;
    let drag = null;
    let panelDrag = null;
    let suppressClick = false;
    let managing = false;
    let renaming = false;
    let editing = null;
    let toastTimer = 0;

    const readPosition = () => {
      try {
        const value = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
        if (Number.isFinite(value?.x) && Number.isFinite(value?.y)) return { x: clamp(value.x, 0, 1), y: clamp(value.y, 0, 1) };
      } catch (_) {}
      return { x: 0.91, y: 0.72 };
    };
    let position = readPosition();
    const readPanelPosition = () => {
      try {
        const value = JSON.parse(localStorage.getItem(PANEL_POSITION_KEY) || 'null');
        if (Number.isFinite(value?.x) && Number.isFinite(value?.y)) return { x: clamp(value.x, 0, 1), y: clamp(value.y, 0, 1) };
      } catch (_) {}
      return null;
    };
    let panelPosition = readPanelPosition();

    const setMode = mode => {
      managing = mode === 'manage';
      renaming = mode === 'rename';
      host.classList.toggle('managing', managing);
      host.classList.toggle('renaming', renaming);
      manageButton.textContent = managing ? '완료' : '정리';
      renameButton.textContent = renaming ? '완료' : '이름 바꾸기';
    };
    const syncEditorMode = () => host.classList.toggle('editor-open', !editor.hidden || !bookmarkletEditor.hidden);
    const closeEditor = () => {
      editing = null;
      editor.hidden = true;
      syncEditorMode();
    };
    const closeBookmarkletEditor = () => {
      bookmarkletEditor.hidden = true;
      syncEditorMode();
    };
    const openBookmarkletEditor = () => {
      setMode('none');
      closeEditor();
      bookmarkletName.value = '';
      bookmarkletIcon.value = '🔖';
      bookmarkletCode.value = '';
      bookmarkletEditor.hidden = false;
      syncEditorMode();
      requestAnimationFrame(() => { placePanel(); bookmarkletName.focus(); });
    };
    const bookmarkletBackupText = () => JSON.stringify({
      type: 'zeta-pocket-bookmarks',
      version: 1,
      bookmarks: savedBookmarklets.map(item => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        code: item.code,
        autoOpen: item.autoOpen !== false,
      })),
    });
    const copyBookmarkletBackup = async () => {
      await ensureBookmarkletStorageReady();
      const backup = bookmarkletBackupText();
      try {
        await navigator.clipboard.writeText(backup);
        toast('북마클릿 백업을 복사했어요');
      } catch (_) {
        w.prompt('아래 백업 코드를 전체 선택해서 복사하세요.', backup);
      }
    };
    const restoreBookmarkletBackup = async () => {
      const raw = w.prompt('다른 기기에서 복사한 북마클릿 백업 코드를 붙여넣으세요.');
      if (!raw) return;
      try {
        await ensureBookmarkletStorageReady();
        const parsed = JSON.parse(raw);
        const incoming = Array.isArray(parsed) ? parsed : parsed?.bookmarks;
        if (!Array.isArray(incoming)) throw new Error('invalid backup');
        const merged = new Map(savedBookmarklets.map(item => [item.id, item]));
        incoming.forEach((item, index) => {
          const code = String(item?.code || '').trim();
          if (!code) return;
          const id = String(item?.id || `bookmarklet:${Date.now().toString(36)}:${index}:${Math.random().toString(36).slice(2, 7)}`);
          merged.set(id, {
            id,
            label: cleanText(item?.label) || '가져온 북마클릿',
            icon: cleanText(item?.icon) || '🔖',
            code,
            autoOpen: item?.autoOpen !== false,
          });
        });
        const previous = savedBookmarklets;
        savedBookmarklets = [...merged.values()];
        try { await persistSavedBookmarklets(); }
        catch (error) {
          savedBookmarklets = previous;
          cacheSavedBookmarklets();
          throw error;
        }
        registerSavedBookmarklets();
        render();
        closeBookmarkletEditor();
        toast(`${incoming.length}개 북마클릿을 불러왔어요`);
      } catch (_) {
        toast('북마클릿 백업 코드를 읽지 못했어요');
      }
    };
    const refreshEditedView = keepRename => {
      const action = editing?.actionID ? actions.get(editing.actionID) : null;
      if (editing?.childID && action) renderChildren(action, keepRename);
      else render();
    };
    const openEditor = (action, child = null) => {
      const item = child || action;
      const shown = presentation(item, child ? action.id : '');
      editing = { actionID: action.id, childID: child?.id || '', base: item };
      editorTitle.textContent = child ? `${presentation(action).label} 기능 꾸미기` : '도구 이름과 아이콘 바꾸기';
      editorName.value = shown.label;
      editorIcon.value = shown.icon;
      editor.hidden = false;
      syncEditorMode();
      requestAnimationFrame(() => { placePanel(); editorName.focus(); editorName.select(); });
    };

    const placeLauncher = () => {
      const info = viewportInfo();
      const size = 42;
      const margin = 10;
      const x = info.left + margin + position.x * Math.max(0, info.width - size - margin * 2);
      const y = info.top + margin + position.y * Math.max(0, info.height - size - margin * 2);
      launcher.style.left = `${Math.round(x)}px`;
      launcher.style.top = `${Math.round(y)}px`;
    };
    const placePanel = () => {
      if (!open) return;
      const info = viewportInfo();
      const launcherRect = launcher.getBoundingClientRect();
      const margin = 10;
      const gap = 9;
      const openRight = launcherRect.left + launcherRect.width / 2 <= info.left + info.width / 2;
      panel.style.removeProperty('width');
      panel.style.transformOrigin = openRight ? 'left center' : 'right center';
      const panelRect = panel.getBoundingClientRect();
      const preferredLeft = openRight
        ? launcherRect.right + gap
        : launcherRect.left - panelRect.width - gap;
      const desiredTop = launcherRect.top + launcherRect.height / 2 - panelRect.height / 2;
      const horizontalRoom = Math.max(0, info.width - panelRect.width - margin * 2);
      const verticalRoom = Math.max(0, info.height - panelRect.height - margin * 2);
      const left = panelPosition
        ? info.left + margin + panelPosition.x * horizontalRoom
        : clamp(preferredLeft, info.left + margin, info.left + info.width - panelRect.width - margin);
      const top = panelPosition
        ? info.top + margin + panelPosition.y * verticalRoom
        : clamp(desiredTop, info.top + margin, info.top + info.height - panelRect.height - margin);
      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(top)}px`;
    };
    const close = () => {
      open = false;
      setMode('none');
      closeEditor();
      closeBookmarkletEditor();
      panelDrag = null;
      host.classList.remove('open');
      host.classList.remove('panel-dragging');
      manageButton.hidden = false;
      renameButton.hidden = false;
      panel.setAttribute('aria-hidden', 'true');
      launcher.setAttribute('aria-expanded', 'false');
    };
    const openPocket = () => {
      if (d.documentElement.classList.contains('zfp-keyboard')) return;
      open = true;
      host.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      launcher.setAttribute('aria-expanded', 'true');
      render();
      requestAnimationFrame(placePanel);
    };
    const toggle = () => open ? close() : openPocket();
    const toast = message => {
      clearTimeout(toastTimer);
      toastNode.textContent = message;
      toastNode.style.opacity = '1';
      toastNode.style.transform = 'translate(-50%,0)';
      toastTimer = w.setTimeout(() => {
        toastNode.style.opacity = '0';
        toastNode.style.transform = 'translate(-50%,8px)';
      }, 1800);
    };

    const showRunStateFeedback = (item, before) => {
      const delays = [80, 220, 520];
      const check = index => {
        const after = readToolRunState(item);
        if (after != null && (before == null || after !== before)) {
          toast(after === 'running' ? '실행 중입니다' : '실행이 취소되었습니다');
          return;
        }
        if (index + 1 < delays.length) w.setTimeout(() => check(index + 1), delays[index + 1] - delays[index]);
      };
      w.setTimeout(() => check(0), delays[0]);
    };

    async function requestScreenFit() {
      syncViewport(true);
      let native = false;
      try {
        if (!d.fullscreenElement && d.documentElement.requestFullscreen) {
          await d.documentElement.requestFullscreen({ navigationUI: 'hide' });
          native = true;
        }
      } catch (_) {}
      syncViewport(true);
      toast(native ? '전체화면을 열었어요' : '현재 화면 크기에 맞췄어요');
    }

    function groupedActions() {
      const builtIn = [{ id: 'builtin:screen', label: '화면 다시 맞춤', icon: '↗', group: '화면', order: 0, run: requestScreenFit }];
      const current = [...builtIn, ...actions.values()].filter(action => !action.element || action.element.isConnected);
      const groupOrder = new Map([['화면', 0], ['도구', 10], ['메모', 20], ['응답 검토', 30], ['기타', 90]]);
      current.sort((a, b) =>
        (groupOrder.get(a.group) ?? 50) - (groupOrder.get(b.group) ?? 50) ||
        a.order - b.order ||
        a.label.localeCompare(b.label, 'ko')
      );
      const groups = new Map();
      current.forEach(action => {
        if (!groups.has(action.group)) groups.set(action.group, []);
        groups.get(action.group).push(action);
      });
      return groups;
    }

    function bindForwardedPress(button, getItem) {
      let active = null;
      let holdTimer = 0;
      let longPressed = false;
      let suppressNextClick = false;
      let startX = 0;
      let startY = 0;
      const clearHold = () => { clearTimeout(holdTimer); holdTimer = 0; };
      button.addEventListener('pointerdown', event => {
        if (managing || renaming || (event.pointerType !== 'touch' && event.button !== 0)) return;
        const item = getItem();
        if (!item || item.forwardPress === false || (Array.isArray(item.children) && item.children.length)) return;
        button.__zetaPocketRunStateBefore = readToolRunState(item);
        active = beginForwardedPress(item, event);
        if (!active) return;
        longPressed = false;
        startX = event.clientX;
        startY = event.clientY;
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
        clearHold();
        holdTimer = w.setTimeout(() => {
          if (!active) return;
          longPressed = true;
          close();
        }, LONG_PRESS_MS);
      }, true);
      button.addEventListener('pointermove', event => {
        if (!active || Math.hypot(event.clientX - startX, event.clientY - startY) <= 8) return;
        clearHold();
        finishForwardedPress(active, event, true);
        active = null;
        suppressNextClick = true;
      }, true);
      const finish = (event, cancelled) => {
        if (!active) return;
        clearHold();
        finishForwardedPress(active, event, cancelled);
        active = null;
        try { button.releasePointerCapture(event.pointerId); } catch (_) {}
        if (!longPressed && !cancelled) return;
        suppressNextClick = true;
        event.preventDefault();
        if (longPressed) close();
      };
      button.addEventListener('pointerup', event => finish(event, false), true);
      button.addEventListener('pointercancel', event => finish(event, true), true);
      button.addEventListener('click', event => {
        if (!suppressNextClick) return;
        suppressNextClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      });
    }

    function render() {
      const groups = groupedActions();
      manageButton.hidden = false;
      renameButton.hidden = false;
      scroll.replaceChildren();
      if (actions.size === 0) {
        const empty = d.createElement('div');
        empty.className = 'empty';
        empty.textContent = '넣고 싶은 플로팅 아이콘을 이 폴더 위로 끌어다 놓으세요.';
        scroll.appendChild(empty);
      }
      for (const [group, items] of groups) {
        const section = d.createElement('section');
        section.className = 'section';
        const title = d.createElement('div');
        title.className = 'section-title';
        title.innerHTML = `<span></span><span class="section-count"></span>`;
        title.firstElementChild.textContent = group;
        title.lastElementChild.textContent = `${items.length}`;
        const grid = d.createElement('div');
        grid.className = 'grid';
        items.forEach(action => {
          const shown = presentation(action);
          const wrap = d.createElement('div');
          wrap.className = `tool-wrap${action.removable ? ' removable' : ''}`;
          const button = d.createElement('button');
          button.type = 'button';
          button.className = 'tool';
          button.title = shown.label;
          const icon = d.createElement('span');
          icon.className = 'tool-icon';
          icon.textContent = shown.icon;
          const label = d.createElement('span');
          label.className = 'tool-label';
          label.textContent = shown.label;
          button.append(icon, label);
          if (!(Array.isArray(action.children) && action.children.length)) {
            bindForwardedPress(button, () => actions.get(action.id) || action);
          }
          button.addEventListener('click', async () => {
            if (managing) return;
            if (renaming) { openEditor(action); return; }
            if (Array.isArray(action.children) && action.children.length) {
              renderChildren(action);
              return;
            }
            close();
            try {
              if (action.removable) scanTools(true);
              const currentAction = actions.get(action.id) || action;
              const beforeState = Object.prototype.hasOwnProperty.call(button, '__zetaPocketRunStateBefore')
                ? button.__zetaPocketRunStateBefore : readToolRunState(currentAction);
              delete button.__zetaPocketRunStateBefore;
              const worked = await currentAction.run();
              if (worked !== false) showRunStateFeedback(currentAction, beforeState);
              if (worked === false && action.removable) {
                unenroll(action.id, `${action.label} 원본을 찾지 못해 밖으로 꺼냈어요`);
              }
            }
            catch (error) {
              console.error('[Zeta Pocket]', action.label, error);
              if (action.removable) unenroll(action.id, `${action.label} 실행이 끊겨 밖으로 꺼냈어요`);
              else toast(`${action.label} 실행에 실패했어요`);
            }
            requestAnimationFrame(() => syncViewport(false));
          });
          wrap.appendChild(button);
          if (action.removable) {
            const remove = d.createElement('button');
            remove.type = 'button';
            remove.className = 'remove';
            remove.setAttribute('aria-label', `${action.label} 주머니에서 꺼내기`);
            remove.textContent = '−';
            remove.addEventListener('click', event => {
              event.preventDefault();
              event.stopPropagation();
              if (typeof action.onRemove === 'function') action.onRemove();
              else unenroll(action.id);
            });
            wrap.appendChild(remove);
          }
          grid.appendChild(wrap);
        });
        section.append(title, grid);
        scroll.appendChild(section);
      }
      const count = actions.size;
      host.classList.toggle('has-items', count > 0);
      launcher.setAttribute('aria-label', count > 0 ? `도구 ${count}개가 든 주머니 열기` : '빈 도구 주머니 열기');
      requestAnimationFrame(placePanel);
    }

    function renderChildren(action, keepRename = false) {
      const actionShown = presentation(action);
      setMode(keepRename ? 'rename' : 'none');
      manageButton.hidden = true;
      renameButton.hidden = false;
      scroll.replaceChildren();
      const back = d.createElement('button');
      back.type = 'button';
      back.className = 'subnav';
      back.innerHTML = '<span>‹</span>';
      back.append(d.createTextNode(actionShown.label));
      back.addEventListener('click', () => { setMode('none'); render(); });
      const section = d.createElement('section');
      section.className = 'section';
      const title = d.createElement('div');
      title.className = 'section-title';
      const titleText = d.createElement('span');
      titleText.textContent = `${actionShown.label} 기능`;
      const titleCount = d.createElement('span');
      titleCount.className = 'section-count';
      titleCount.textContent = `${action.children.length}`;
      title.append(titleText, titleCount);
      const grid = d.createElement('div');
      grid.className = 'grid';
      action.children.forEach(child => {
        const shown = presentation(child, action.id);
        const wrap = d.createElement('div');
        wrap.className = 'tool-wrap';
        const button = d.createElement('button');
        button.type = 'button';
        button.className = 'tool';
        button.title = shown.label;
        const icon = d.createElement('span');
        icon.className = 'tool-icon';
        icon.textContent = shown.icon;
        const label = d.createElement('span');
        label.className = 'tool-label';
        label.textContent = shown.label;
        button.append(icon, label);
        bindForwardedPress(button, () => {
          const currentAction = actions.get(action.id);
          return currentAction?.children?.find(item => item.id === child.id) || child;
        });
        button.addEventListener('click', async () => {
          if (renaming) { openEditor(action, child); return; }
          close();
          try {
            scanTools(true);
            const currentAction = actions.get(action.id);
            const currentChild = currentAction?.children?.find(item => item.id === child.id) || child;
            const beforeState = Object.prototype.hasOwnProperty.call(button, '__zetaPocketRunStateBefore')
              ? button.__zetaPocketRunStateBefore : readToolRunState(currentChild);
            delete button.__zetaPocketRunStateBefore;
            const worked = currentAction ? await currentChild.run() : false;
            if (worked !== false) showRunStateFeedback(currentChild, beforeState);
            if (worked === false && action.removable) {
              unenroll(action.id, `${action.label} 원본을 찾지 못해 밖으로 꺼냈어요`);
            }
          }
          catch (error) {
            console.error('[Zeta Pocket]', `${action.label} · ${child.label}`, error);
            if (action.removable) unenroll(action.id, `${action.label} 실행이 끊겨 밖으로 꺼냈어요`);
            else toast(`${child.label} 실행에 실패했어요`);
          }
          requestAnimationFrame(() => syncViewport(false));
        });
        wrap.appendChild(button);
        grid.appendChild(wrap);
      });
      section.append(title, grid);
      scroll.append(back, section);
      requestAnimationFrame(placePanel);
    }

    launcher.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch' && event.button !== 0) return;
      const rect = launcher.getBoundingClientRect();
      drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, moved: false };
      launcher.setPointerCapture?.(event.pointerId);
    });
    launcher.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.hypot(dx, dy) > 5) drag.moved = true;
      if (!drag.moved) return;
      const info = viewportInfo();
      launcher.style.left = `${clamp(drag.left + dx, info.left + 8, info.left + info.width - 50)}px`;
      launcher.style.top = `${clamp(drag.top + dy, info.top + 8, info.top + info.height - 50)}px`;
      event.preventDefault();
    });
    const finishDrag = event => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = drag.moved;
      drag = null;
      launcher.releasePointerCapture?.(event.pointerId);
      if (!moved) return;
      suppressClick = true;
      const info = viewportInfo();
      const rect = launcher.getBoundingClientRect();
      position = {
        x: clamp((rect.left - info.left - 10) / Math.max(1, info.width - rect.width - 20), 0, 1),
        y: clamp((rect.top - info.top - 10) / Math.max(1, info.height - rect.height - 20), 0, 1),
      };
      panelPosition = null;
      try {
        localStorage.setItem(POSITION_KEY, JSON.stringify(position));
        localStorage.removeItem(PANEL_POSITION_KEY);
      } catch (_) {}
      event.preventDefault();
    };
    launcher.addEventListener('pointerup', finishDrag);
    launcher.addEventListener('pointercancel', finishDrag);
    launcher.addEventListener('click', event => {
      if (suppressClick) { suppressClick = false; event.preventDefault(); return; }
      toggle();
    });
    head.addEventListener('pointerdown', event => {
      if (event.target.closest?.('button')) return;
      if (event.pointerType !== 'touch' && event.button !== 0) return;
      const rect = panel.getBoundingClientRect();
      panelDrag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top };
      host.classList.add('panel-dragging');
      head.setPointerCapture?.(event.pointerId);
    });
    head.addEventListener('pointermove', event => {
      if (!panelDrag || panelDrag.id !== event.pointerId) return;
      const info = viewportInfo();
      const rect = panel.getBoundingClientRect();
      const left = clamp(panelDrag.left + event.clientX - panelDrag.startX, info.left + 8, info.left + info.width - rect.width - 8);
      const top = clamp(panelDrag.top + event.clientY - panelDrag.startY, info.top + 8, info.top + info.height - rect.height - 8);
      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(top)}px`;
      event.preventDefault();
    });
    const finishPanelDrag = event => {
      if (!panelDrag || panelDrag.id !== event.pointerId) return;
      panelDrag = null;
      host.classList.remove('panel-dragging');
      head.releasePointerCapture?.(event.pointerId);
      const info = viewportInfo();
      const rect = panel.getBoundingClientRect();
      panelPosition = {
        x: clamp((rect.left - info.left - 8) / Math.max(1, info.width - rect.width - 16), 0, 1),
        y: clamp((rect.top - info.top - 8) / Math.max(1, info.height - rect.height - 16), 0, 1),
      };
      try { localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify(panelPosition)); } catch (_) {}
      event.preventDefault();
    };
    head.addEventListener('pointerup', finishPanelDrag);
    head.addEventListener('pointercancel', finishPanelDrag);
    shadow.querySelector('.scrim').addEventListener('click', close);
    shadow.querySelector('.close').addEventListener('click', close);
    manageButton.addEventListener('click', () => {
      setMode(managing ? 'none' : 'manage');
    });
    renameButton.addEventListener('click', () => {
      setMode(renaming ? 'none' : 'rename');
    });
    addButton.addEventListener('click', openBookmarkletEditor);
    shadow.querySelector('.editor-cancel').addEventListener('click', closeEditor);
    shadow.querySelector('.editor-reset').addEventListener('click', () => {
      if (!editing) return;
      delete customizations[customizationKey(editing.actionID, editing.childID)];
      persistCustomizations();
      const wasChild = Boolean(editing.childID);
      refreshEditedView(true);
      closeEditor();
      toast(wasChild ? '기능 이름과 아이콘을 되돌렸어요' : '도구 이름과 아이콘을 되돌렸어요');
    });
    editor.addEventListener('submit', async event => {
      event.preventDefault();
      if (!editing) return;
      await ensureBookmarkletStorageReady();
      const label = cleanText(editorName.value) || editing.base.label || '도구';
      const icon = cleanText(editorIcon.value) || editing.base.icon || iconFor(label);
      customizations[customizationKey(editing.actionID, editing.childID)] = { label, icon };
      if (!editing.childID && editing.actionID.startsWith('bookmarklet:')) {
        const saved = savedBookmarklets.find(item => item.id === editing.actionID);
        if (saved) {
          const previous = { label: saved.label, icon: saved.icon };
          saved.label = label;
          saved.icon = icon;
          try { await persistSavedBookmarklets(); }
          catch (_) {
            saved.label = previous.label;
            saved.icon = previous.icon;
            cacheSavedBookmarklets();
            toast('북마클릿 이름을 저장하지 못했어요');
            return;
          }
        }
      }
      persistCustomizations();
      const wasChild = Boolean(editing.childID);
      refreshEditedView(true);
      closeEditor();
      toast(wasChild ? '기능 이름과 아이콘을 저장했어요' : '도구 이름과 아이콘을 저장했어요');
    });
    shadow.querySelector('.bookmarklet-cancel').addEventListener('click', closeBookmarkletEditor);
    shadow.querySelector('.bookmarklet-backup').addEventListener('click', copyBookmarkletBackup);
    shadow.querySelector('.bookmarklet-restore').addEventListener('click', restoreBookmarkletBackup);
    bookmarkletEditor.addEventListener('submit', async event => {
      event.preventDefault();
      await ensureBookmarkletStorageReady();
      const label = cleanText(bookmarkletName.value);
      const code = String(bookmarkletCode.value || '').trim();
      if (!label || !code) {
        toast('이름과 북마클릿 코드를 모두 입력해 주세요');
        return;
      }
      const id = `bookmarklet:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
      savedBookmarklets.push({ id, label, icon: cleanText(bookmarkletIcon.value) || '🔖', code, autoOpen: true });
      try { await persistSavedBookmarklets(); }
      catch (_) {
        savedBookmarklets = savedBookmarklets.filter(item => item.id !== id);
        cacheSavedBookmarklets();
        toast('북마클릿을 저장하지 못했어요');
        return;
      }
      registerSavedBookmarklets();
      render();
      closeBookmarkletEditor();
      toast(`${label} 북마클릿을 추가했어요`);
    });

    placeLauncher();
    render();
    return { host, shadow, launcher, panel, render, close, placeLauncher, placePanel, toast };
  }

  function mutationsTouch(mutations, selector) {
    return mutations.some(mutation => {
      if (mutation.type === 'attributes') return mutation.target instanceof Element && mutation.target.matches(selector);
      return [...mutation.addedNodes, ...mutation.removedNodes].some(node =>
        node instanceof Element && (node.matches(selector) || node.querySelector(selector))
      );
    });
  }

  function queueScan(mutations = [], force = false) {
    const toolChanged = force || mutations.length === 0 || mutationsTouch(mutations, `${TOOL_NODE_SELECTOR},${TOOL_CONTROL_SELECTOR}`);
    const editChanged = mutationsTouch(mutations, '#portal-container,[data-sentry-component="KeyboardAvoidingView"]');
    const pageChanged = mutationsTouch(mutations, 'main#contents,[data-sentry-component="ChatRoomViewContainer"]');
    if (removeStaleActions()) pocket?.render?.();
    if (!toolChanged && !editChanged && !pageChanged) return;
    if (toolChanged) {
      scanTools(true);
      cancelAnimationFrame(scanFrame);
      scanFrame = requestAnimationFrame(() => {
        scanFrame = 0;
        scanTools(true);
      });
    }
    clearTimeout(scanTimer);
    scanTimer = w.setTimeout(() => {
      if (toolChanged) scanTools(true);
      if (pageChanged) syncThemeColor(true);
      if (editChanged) syncEditWindow();
      if (editChanged || pageChanged) queueViewport(false);
    }, 80);
  }

  function draggedIconCandidate(event) {
    const path = event.composedPath?.() || [];
    const elements = path.filter(node => node instanceof HTMLElement && node !== d.body && node !== d.documentElement);
    if (elements.some(element => element.hasAttribute?.(BOOKMARKLET_LAUNCHER_ATTR))) return null;
    const interactive = elements.find(element => element.matches?.(`${TOOL_CONTROL_SELECTOR},[tabindex]`)) || null;
    const carrier = dragCarrier(elements);
    const element = interactive || carrier;
    if (!element || !carrier || element.closest?.(`#${HOST_ID}`)) return null;

    const grouped = findToolbarGroup(element);
    if (grouped) {
      scanToolbarGroups();
      const id = elementActions.get(grouped.container);
      if (id && !selectedIDs.has(id)) return id;
    }

    const label = accessibleName(element, '플로팅 도구');
    return registerElement(element, {
      id: draggedCandidateID(element),
      label,
      icon: iconFor(label),
      group: '기타',
      order: 950,
      hideTarget: carrier,
    });
  }

  function dragCarrier(elements) {
    const carriers = elements.filter(element => {
      if (element.closest?.(`#${HOST_ID}`) || !visible(element)) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width < 12 || rect.height < 12 || rect.width > 120 || rect.height > 120) return false;
      const style = getComputedStyle(element);
      const zIndex = Number.parseInt(style.zIndex, 10) || 0;
      return style.position === 'fixed' || ((style.position === 'absolute' || style.position === 'sticky') && zIndex >= 1000);
    });
    return carriers.sort((left, right) => {
      const a = left.getBoundingClientRect();
      const b = right.getBoundingClientRect();
      return b.width * b.height - a.width * a.height;
    })[0] || null;
  }

  function visualCarrierForElement(element) {
    const elements = [];
    for (let current = element, depth = 0; current instanceof HTMLElement && depth < 10; current = current.parentElement, depth += 1) {
      elements.push(current);
    }
    const root = element?.getRootNode?.();
    if (root instanceof ShadowRoot && root.host instanceof HTMLElement) elements.push(root.host);
    return dragCarrier(elements) || element;
  }

  function candidateIDsFromEvent(event) {
    const path = event.composedPath?.() || [];
    const matches = [];
    candidates.forEach(candidate => {
      if (selectedIDs.has(candidate.id)) return;
      if (path.includes(candidate.element) || path.includes(candidate.hideTarget)) matches.push(candidate);
    });
    if (matches.length) {
      matches.sort((left, right) => {
        const leftChildren = Array.isArray(left.children) ? left.children.length : 0;
        const rightChildren = Array.isArray(right.children) ? right.children.length : 0;
        if (leftChildren !== rightChildren) return rightChildren - leftChildren;
        const leftIndex = Math.min(...[left.element, left.hideTarget].map(element => path.indexOf(element)).filter(index => index >= 0));
        const rightIndex = Math.min(...[right.element, right.hideTarget].map(element => path.indexOf(element)).filter(index => index >= 0));
        return rightIndex - leftIndex;
      });
      const candidate = matches[0];
      const elements = path.filter(node => node instanceof HTMLElement && node !== d.body && node !== d.documentElement);
      const carrier = dragCarrier(elements);
      const current = candidate.hideTarget?.isConnected ? candidate.hideTarget : candidate.element;
      const currentIndex = path.indexOf(current);
      const carrierIndex = path.indexOf(carrier);
      if (carrier && current === candidate.element && carrier !== current
          && carrierIndex >= 0 && currentIndex >= 0 && carrierIndex > currentIndex) {
        candidate.hideTarget = carrier;
        const carrierRoot = carrier.getRootNode();
        candidate.root = carrierRoot instanceof ShadowRoot ? carrierRoot : d;
      }
      return [candidate.id];
    }
    const ids = [];
    if (!matches.length) {
      const id = draggedIconCandidate(event);
      if (id && !selectedIDs.has(id)) ids.push(id);
    }
    return ids;
  }

  function dragPoint(event) {
    if (/^touch/.test(event.type)) {
      const touch = event.changedTouches?.[0] || event.touches?.[0];
      if (!touch) return null;
      return { id: `touch:${touch.identifier}`, family: 'touch', pointerType: 'touch', clientX: touch.clientX, clientY: touch.clientY, button: 0 };
    }
    if (/^mouse/.test(event.type)) {
      return { id: 'mouse:primary', family: 'mouse', pointerType: 'mouse', clientX: event.clientX, clientY: event.clientY, button: event.button };
    }
    return { id: `pointer:${event.pointerId}`, family: 'pointer', pointerId: event.pointerId, pointerType: event.pointerType || 'mouse', clientX: event.clientX, clientY: event.clientY, button: event.button };
  }

  function watchCandidateDragRoot(root) {
    if (!root?.addEventListener || candidateDragRoots.has(root)) return;
    candidateDragRoots.add(root);
    on(root, 'pointerdown', beginCandidateDrag, true);
    on(root, 'pointermove', moveCandidateDrag, true);
    on(root, 'pointerup', endCandidateDrag, true);
    on(root, 'pointercancel', endCandidateDrag, true);
    on(root, 'touchstart', beginCandidateDrag, { capture: true, passive: true });
    on(root, 'touchmove', moveCandidateDrag, { capture: true, passive: false });
    on(root, 'touchend', endCandidateDrag, { capture: true, passive: true });
    on(root, 'touchcancel', endCandidateDrag, { capture: true, passive: true });
    on(root, 'mousedown', beginCandidateDrag, true);
    on(root, 'mousemove', moveCandidateDrag, true);
    on(root, 'mouseup', endCandidateDrag, true);
  }

  function watchToolRoot(root) {
    if (!(root instanceof ShadowRoot) || root.host?.id === HOST_ID || toolRootObservers.has(root)) return;
    const observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => {
        const target = mutation.target instanceof Element ? mutation.target : null;
        if (target?.closest?.('[role="toolbar"],[class*="toolbar"],[class*="tool-bar"],[class*="tabbar"],[class*="dock"],[class*="toolbox"],[class*="palette"]')) return true;
        return [...mutation.addedNodes, ...mutation.removedNodes].some(node =>
          node instanceof Element && (node.matches(TOOL_NODE_SELECTOR) || node.querySelector?.(TOOL_NODE_SELECTOR))
        );
      });
      if (relevant) queueScan(mutations, true);
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'role', 'aria-label', 'aria-hidden', 'aria-expanded', 'data-action'],
    });
    toolRootObservers.set(root, observer);
  }

  function overPocket(clientX, clientY) {
    const rect = pocket?.launcher?.getBoundingClientRect?.();
    if (!rect) return false;
    const size = 30;
    const left = rect.left + (rect.width - size) / 2;
    const top = rect.top + (rect.height - size) / 2;
    return clientX >= left && clientX <= left + size && clientY >= top && clientY <= top + size;
  }

  function candidateOverPocket(ids, clientX, clientY) {
    if (overPocket(clientX, clientY)) return true;
    const rect = pocket?.launcher?.getBoundingClientRect?.();
    if (!rect) return false;
    const size = 30;
    const dropRect = {
      left: rect.left + (rect.width - size) / 2,
      top: rect.top + (rect.height - size) / 2,
      right: rect.left + (rect.width + size) / 2,
      bottom: rect.top + (rect.height + size) / 2,
    };
    return (ids || []).some(id => {
      const candidate = candidates.get(id);
      const target = candidate?.hideTarget?.isConnected ? candidate.hideTarget : candidate?.element;
      if (!(target instanceof Element)) return false;
      const source = target.getBoundingClientRect();
      const overlapWidth = Math.min(source.right, dropRect.right) - Math.max(source.left, dropRect.left);
      const overlapHeight = Math.min(source.bottom, dropRect.bottom) - Math.max(source.top, dropRect.top);
      return overlapWidth >= 8 && overlapHeight >= 8;
    });
  }

  function beginCandidateDrag(event) {
    const point = dragPoint(event);
    if (!point) return;
    if (point.family === 'pointer') lastPointerDragAt = Date.now();
    if (point.family !== 'pointer' && Date.now() - lastPointerDragAt < 120) return;
    if (forwardedPointerIDs.has(point.pointerId)) return;
    if (point.pointerType !== 'touch' && point.button !== 0) return;
    if (candidateDrag) return;
    const path = event.composedPath?.() || [];
    if (path.includes(pocket?.host)) return;
    const ids = candidateIDsFromEvent(event);
    if (!ids.length) return;
    candidateDrag = { id: point.id, family: point.family, ids, startX: point.clientX, startY: point.clientY, moved: false, hovering: false };
    pocket.host.classList.add('drop-ready');
  }

  function moveCandidateDrag(event) {
    const point = dragPoint(event);
    if (!candidateDrag || !point || candidateDrag.id !== point.id) return;
    if (Math.hypot(point.clientX - candidateDrag.startX, point.clientY - candidateDrag.startY) > 6) candidateDrag.moved = true;
    if (candidateDrag.moved && event.cancelable) event.preventDefault();
    candidateDrag.hovering = candidateDrag.moved && candidateOverPocket(candidateDrag.ids, point.clientX, point.clientY);
    pocket.host.classList.toggle('drop-hover', candidateDrag.hovering);
  }

  function endCandidateDrag(event) {
    const point = dragPoint(event);
    if (!candidateDrag || !point || candidateDrag.id !== point.id) return;
    const ids = candidateDrag.ids;
    const drop = candidateDrag.moved && (candidateDrag.hovering || candidateOverPocket(ids, point.clientX, point.clientY));
    candidateDrag = null;
    pocket.host.classList.remove('drop-ready', 'drop-hover');
    if (drop) enroll(ids);
  }

  function start() {
    addViewportMeta();
    installPageStyle();
    d.documentElement.classList.add('zfp-screen');
    pocket = createPocket();
    registerSavedBookmarklets();
    void ensureBookmarkletStorageReady();
    syncViewport(false);
    scanTools();
    // Third-party launchers often mount after DOMContentLoaded or hydration.
    [80, 220, 500, 1000, 1800, 3000].forEach(delay =>
      w.setTimeout(() => scanTools(true), delay)
    );
    if (handoffOriginals.size) w.setTimeout(() => {
      [...handoffOriginals.keys()].forEach(restoreHandoffTarget);
    }, 1500);

    mutationObserver = new MutationObserver(mutations => queueScan(mutations));
    mutationObserver.observe(d.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'role', 'aria-label', 'title', 'data-action', 'data-view', 'data-name', 'data-zeta-review-tabbar-drag'],
    });
    scanInterval = w.setInterval(() => scanTools(false), 5000);

    on(w, 'resize', () => {
      if (!shouldPauseExternalViewport()) queueViewport(true);
    }, { passive: true });
    on(w, 'orientationchange', () => w.setTimeout(() => queueViewport(true), 120), { passive: true });
    on(w.visualViewport, 'resize', () => {
      if (!shouldPauseExternalViewport()) queueViewport(true);
    }, { passive: true });
    on(w.visualViewport, 'scroll', () => {
      if (!shouldPauseExternalViewport()) queueViewport(false);
    }, { passive: true });
    on(d, 'focusin', event => {
      const active = deepActiveElement();
      if (isExternalToolTextControl(active)) {
        clearTimeout(externalViewportResumeTimer);
        externalViewportResumeTimer = 0;
        externalViewportHoldUntil = 0;
        return;
      }
      if (isTextControl(active) && !isPocketTextControl(active)) {
        clearTimeout(externalViewportResumeTimer);
        externalViewportResumeTimer = 0;
        externalViewportHoldUntil = 0;
        pocket?.close?.();
        [0, 40, 100, 180, 320, 600].forEach(delay => w.setTimeout(() => syncViewport(true), delay));
      }
      syncEditWindow();
    }, true);
    on(d, 'focusout', event => {
      if (isExternalToolElement(event.target)) {
        releaseExternalViewportAfterKeyboard();
        return;
      }
      [40, 120, 300].forEach(delay => w.setTimeout(() => syncViewport(false), delay));
    }, true);
    on(d, BRIDGE_INFO_EVENT, () => queueScan([], true), true);
    on(d, 'pointerdown', guardEditAsterisk, true);
    on(d, 'keydown', guardEditTyping, true);
    on(d, 'beforeinput', guardEditTyping, true);
    on(d, 'input', guardEditTyping, true);
    on(d, 'click', event => {
      [0, 120, 500].forEach(delay => w.setTimeout(() => syncThemeColor(delay > 0), delay));
      if (event.target?.closest?.('button[data-testid="edit-button"],[aria-label*="수정"]')) {
        [0, 50, 120, 240, 500].forEach(delay => w.setTimeout(syncEditWindow, delay));
      }
    }, true);
    watchCandidateDragRoot(d);
  }

  function destroy() {
    clearTimeout(scanTimer);
    clearTimeout(externalViewportResumeTimer);
    clearInterval(scanInterval);
    cancelAnimationFrame(scanFrame);
    cancelAnimationFrame(editFrame);
    cancelAnimationFrame(viewportFrame);
    mutationObserver?.disconnect();
    toolRootObservers.forEach(observer => observer.disconnect());
    toolRootObservers.clear();
    disposers.splice(0).forEach(dispose => { try { dispose(); } catch (_) {} });
    restoreEditWindow();
    restoreOriginals();
    [...handoffOriginals.keys()].forEach(restoreHandoffTarget);
    d.getElementById(STYLE_ID)?.remove();
    d.getElementById(THEME_META_ID)?.remove();
    d.getElementById(HOST_ID)?.remove();
    if (pocketAttachShadow && w.Element?.prototype?.attachShadow === pocketAttachShadow) {
      try { w.Element.prototype.attachShadow = originalAttachShadow; } catch (_) {}
    }
    d.documentElement.classList.remove('zfp-screen', 'zfp-keyboard');
    d.documentElement.style.removeProperty('--zfp-vv-height');
    d.documentElement.style.removeProperty('--zfp-vv-width');
    d.documentElement.style.removeProperty('--zfp-vv-top');
    d.documentElement.style.removeProperty('--zfp-vv-left');
    d.documentElement.style.removeProperty('--zfp-keyboard');
    d.documentElement.style.removeProperty('--zfp-page-bg');
    try { delete w[INSTANCE_KEY]; } catch (_) { w[INSTANCE_KEY] = undefined; }
  }

  w[INSTANCE_KEY] = {
    destroy,
    rescan: scanTools,
    fit: () => syncViewport(true),
    registerCandidate(action) {
      if (!(action?.element instanceof HTMLElement)) return false;
      return registerElement(action.element, action) || false;
    },
    remove(id, message = '') {
      id = String(id || '');
      if (!selectedIDs.has(id)) return false;
      unenroll(id, message);
      return true;
    },
    register(action) {
      if (!action?.id || typeof action.run !== 'function') return false;
      addAction(action);
      return true;
    },
    unregister(id) {
      actions.delete(String(id));
      pocket?.render?.();
    },
  };
  w.ZetaPocket = w[INSTANCE_KEY];

  if (d.documentElement) start();
  else on(d, 'readystatechange', () => { if (d.documentElement) start(); }, { once: true });
  // Standalone patched build: remote all.js must not replace the pocket after startup.
  // checkRuntimeUpdate();
})();