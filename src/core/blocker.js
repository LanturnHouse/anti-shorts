/**
 * anti-shorts 차단 엔진 (플랫폼 독립, DOM 기반).
 *
 * window/document 만 있으면 동작하므로 크롬 확장의 content script,
 * 모바일 브라우저 확장, 유저스크립트 등에서 그대로 재사용할 수 있다.
 * 브라우저 확장 전용 API(chrome.*)는 절대 사용하지 않는다.
 *
 * 하는 일:
 *   1. 숏츠 URL 이면 즉시 메인 페이지로 리다이렉트
 *      (/watch?v= 로 열린 숏츠 영상도 판별해서 리다이렉트)
 *   2. 숏츠 요소를 숨기는 <style> 을 문서 로드 전에 주입 (깜빡임 방지)
 *   3. 숏츠 링크 클릭을 캡처 단계에서 가로채 SPA 내부 이동 자체를 막음
 *   4. "Shorts" 텍스트로만 구분되는 칩/탭을 MutationObserver 로 숨김
 *   5. SPA 내비게이션(pushState 등)으로 숏츠 URL 에 도달한 경우도 감시
 */
(function (root) {
  'use strict';

  const HIDDEN_ATTR = 'data-anti-shorts-hidden';
  const STYLE_ID = 'anti-shorts-style';

  function start(options) {
    const opts = options || {};
    const win = opts.window || root;
    const doc = opts.document || win.document;
    const rules = opts.rules || (root.AntiShorts && root.AntiShorts.rules);
    if (!rules) throw new Error('[anti-shorts] rules not loaded');

    if (win.__antiShortsStarted) return;
    win.__antiShortsStarted = true;

    const platform = opts.platform || rules.platformForHost(win.location.hostname);

    // ── 1. 리다이렉트 ─────────────────────────────────────────
    let redirecting = false;
    function goHome() {
      if (redirecting) return;
      redirecting = true;
      // 숏츠 영상이 소리를 내기 전에 멈춤
      doc.querySelectorAll('video').forEach((v) => {
        try { v.pause(); v.muted = true; } catch (_) { /* noop */ }
      });
      // replace: 뒤로 가기로 숏츠에 되돌아가지 않도록 히스토리에 남기지 않음
      win.location.replace(rules.redirectTarget(win.location.href));
    }

    function redirectIfShorts() {
      if (redirecting) return true;
      if (!rules.isShortsUrl(win.location.href)) return false;
      goHome();
      return true;
    }

    // ── 1-2. /watch?v= 로 열린 숏츠 영상 차단 ─────────────────
    // 숏츠 링크가 /watch?v=<id> 로 바뀌어 열리면 일반 영상처럼 재생된다.
    // canonical 링크 → (없거나 낡았으면) /shorts/<id> HEAD 요청 순으로 판정한다.
    const shortsVerdicts = new Map(); // videoId -> true | false | 'pending'

    function probeIsShorts(videoId) {
      return win
        .fetch(rules.shortsProbePath(videoId), {
          method: 'HEAD',
          redirect: 'manual',
          credentials: 'include',
        })
        .then((res) => {
          if (res.type === 'opaqueredirect') return false; // 일반 영상 → /watch 로 리다이렉트됨
          if (res.ok) return true;
          throw new Error(`unexpected status ${res.status}`);
        });
    }

    function checkWatchPage() {
      if (redirecting) return;
      const videoId = rules.watchVideoId(win.location.href);
      if (!videoId) return;

      const cached = shortsVerdicts.get(videoId);
      if (cached === undefined || cached === 'pending') {
        const canonical = doc.querySelector('link[rel="canonical"]');
        const verdict = canonical && rules.shortsVerdictFromCanonical(canonical.href, videoId);
        if (verdict === true || verdict === false) shortsVerdicts.set(videoId, verdict);
      }

      const known = shortsVerdicts.get(videoId);
      if (known === true) return goHome();
      if (known !== undefined) return; // false 또는 'pending'

      shortsVerdicts.set(videoId, 'pending');
      probeIsShorts(videoId).then(
        (isShorts) => {
          shortsVerdicts.set(videoId, isShorts);
          if (isShorts && rules.watchVideoId(win.location.href) === videoId) goHome();
        },
        // 네트워크 오류 등: 잠시 뒤 다시 확인할 수 있게 비워 둔다
        () => win.setTimeout(() => shortsVerdicts.delete(videoId), 5000),
      );
    }

    if (redirectIfShorts()) return;

    // ── 2. 숨김 스타일 주입 ───────────────────────────────────
    function buildCss() {
      // 셀렉터 하나가 브라우저에서 지원되지 않아도 나머지가 살아남도록 규칙을 분리
      const rulesCss = rules
        .selectorsFor(platform)
        .map((sel) => `${sel}{display:none!important}`);
      rulesCss.push(`[${HIDDEN_ATTR}]{display:none!important}`);
      return rulesCss.join('\n');
    }

    function injectStyle() {
      if (doc.getElementById(STYLE_ID)) return;
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = buildCss();
      (doc.head || doc.documentElement).appendChild(style);
    }
    injectStyle();

    // ── 3. 숏츠 링크 클릭 가로채기 ─────────────────────────────
    function onClick(event) {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      const link = target.closest('a[href]');
      if (!link || !rules.isShortsUrl(link.href)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    // 캡처 단계에서 유튜브의 라우터보다 먼저 받는다
    win.addEventListener('click', onClick, true);
    win.addEventListener('auxclick', onClick, true);

    // ── 4. 텍스트 기반 숨김 ───────────────────────────────────
    const textTargetSelector = rules.textTargetSelectors.join(',');
    function hideTextLabeled(scope) {
      const base = scope && scope.querySelectorAll ? scope : doc;
      const nodes = base.querySelectorAll(textTargetSelector);
      for (const el of nodes) {
        if (el.hasAttribute(HIDDEN_ATTR)) continue;
        if (rules.isShortsLabel(el.textContent)) el.setAttribute(HIDDEN_ATTR, '');
      }
    }

    // ── 5. DOM / URL 변화 감시 ────────────────────────────────
    let scheduled = false;
    function scan() {
      scheduled = false;
      if (redirectIfShorts()) return;
      checkWatchPage();
      // <head> 가 스타일 주입 후 교체되는 경우 대비
      injectStyle();
      hideTextLabeled(doc);
    }
    function scheduleScan() {
      if (scheduled) return;
      scheduled = true;
      (win.requestAnimationFrame || win.setTimeout).call(win, scan);
    }

    const observer = new win.MutationObserver(scheduleScan);
    observer.observe(doc.documentElement, { childList: true, subtree: true });

    // 유튜브 SPA 내비게이션 이벤트 (데스크톱/모바일)
    ['yt-navigate-start', 'yt-navigate-finish', 'yt-page-data-updated', 'state-navigateend']
      .forEach((type) => doc.addEventListener(type, scheduleScan, true));
    win.addEventListener('popstate', scheduleScan, true);

    // Navigation API 가 있으면 숏츠로의 이동을 가장 이른 시점에 차단
    if (win.navigation && typeof win.navigation.addEventListener === 'function') {
      win.navigation.addEventListener('navigate', (event) => {
        if (event.destination && rules.isShortsUrl(event.destination.url)) {
          if (event.cancelable) event.preventDefault();
          win.location.replace(rules.redirectTarget(event.destination.url));
        }
      });
    }

    // 위 경로를 모두 빠져나가는 경우를 위한 최후의 안전망
    win.setInterval(() => {
      if (!redirectIfShorts()) checkWatchPage();
    }, 1000);

    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', scheduleScan, { once: true });
    } else {
      scheduleScan();
    }
  }

  const api = { start, HIDDEN_ATTR, STYLE_ID };
  root.AntiShorts = Object.assign(root.AntiShorts || {}, { blocker: api });
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
