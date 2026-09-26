/**
 * anti-shorts 차단 규칙 (플랫폼 독립).
 *
 * 이 파일은 DOM/브라우저 API에 의존하지 않는 순수 데이터와 함수만 담는다.
 * 크롬 확장, 모바일(유저스크립트/모바일 브라우저 확장) 등 모든 플랫폼이 공유한다.
 * 유튜브가 마크업을 바꾸면 대부분 이 파일의 셀렉터만 고치면 된다.
 */
(function (root) {
  'use strict';

  const YOUTUBE_HOSTS = ['www.youtube.com', 'youtube.com', 'm.youtube.com'];

  // /shorts, /shorts/, /shorts/<id>, /shorts/<id>?feature=share ...
  const SHORTS_PATH_RE = /^\/shorts(\/|$)/i;

  // 숏츠 링크를 가리키는 속성 셀렉터 (상대/절대 경로 모두)
  const SHORTS_LINK = 'a[href^="/shorts"], a[href*="youtube.com/shorts"]';
  const has = (container, inner) => `${container}:has(${inner})`;
  const hasShortsLink = (container) => has(container, SHORTS_LINK);

  /** PC 유튜브 (www.youtube.com) */
  const desktopSelectors = [
    // ── 왼쪽 사이드바 / 미니 사이드바 ──
    'ytd-guide-entry-renderer:has(a[title="Shorts"])',
    'ytd-guide-entry-renderer:has(a[href^="/shorts"])',
    'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
    'ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])',
    'ytd-mini-guide-entry-renderer:has(a[title="Shorts"])',

    // ── 홈 / 구독 / 탐색 피드의 숏츠 선반 ──
    'ytd-rich-shelf-renderer[is-shorts]',
    has('ytd-rich-section-renderer', 'ytd-rich-shelf-renderer[is-shorts]'),
    has('ytd-rich-section-renderer', 'ytm-shorts-lockup-view-model'),
    has('ytd-rich-section-renderer', 'ytm-shorts-lockup-view-model-v2'),
    // 주의: ytd-item-section-renderer 는 영상 오른쪽 추천 목록/검색 결과 "전체"를 감싸므로
    // :has() 로 숨기면 안 된다. 숏츠 선반 자체만 숨긴다.
    'ytd-reel-shelf-renderer',
    'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)',
    'grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2)',
    'ytm-shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2',

    // ── 피드/검색/추천 목록 속 개별 숏츠 영상 ──
    hasShortsLink('ytd-rich-item-renderer'),
    has('ytd-rich-item-renderer', '[overlay-style="SHORTS"]'),
    hasShortsLink('ytd-video-renderer'),
    has('ytd-video-renderer', '[overlay-style="SHORTS"]'),
    hasShortsLink('ytd-grid-video-renderer'),
    has('ytd-grid-video-renderer', '[overlay-style="SHORTS"]'),
    hasShortsLink('ytd-compact-video-renderer'),
    has('ytd-compact-video-renderer', '[overlay-style="SHORTS"]'),
    hasShortsLink('yt-lockup-view-model'),
    hasShortsLink('ytd-playlist-video-renderer'),

    // ── 알림 / 채널 탭 ──
    hasShortsLink('ytd-notification-renderer'),
    'yt-tab-shape[tab-title="Shorts"]',
    'tp-yt-paper-tab:has(.tab-content[title="Shorts"])',

    // ── 숏츠 플레이어 자체 (리다이렉트 전 잠깐 보이는 것 방지) ──
    'ytd-shorts',
  ];

  /** 모바일 웹 유튜브 (m.youtube.com) — 2차 목표에서 사용 */
  const mobileSelectors = [
    // 하단 탭바의 Shorts 버튼
    'ytm-pivot-bar-item-renderer:has(.pivot-shorts)',
    'ytm-pivot-bar-item-renderer:has(a[href^="/shorts"])',

    // 숏츠 선반
    'ytm-reel-shelf-renderer',
    has('ytm-rich-section-renderer', 'ytm-reel-shelf-renderer'),
    has('ytm-rich-section-renderer', 'ytm-shorts-lockup-view-model'),
    has('ytm-rich-section-renderer', 'ytm-shorts-lockup-view-model-v2'),
    'ytm-shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2',

    // 개별 숏츠 영상
    hasShortsLink('ytm-rich-item-renderer'),
    hasShortsLink('ytm-video-with-context-renderer'),
    hasShortsLink('ytm-compact-video-renderer'),
    hasShortsLink('ytm-video-card-renderer'),

    // 숏츠 플레이어
    'shorts-video',
    'ytm-shorts-player-renderer',
  ];

  /**
   * CSS만으로는 잡기 어려운, "Shorts" 라는 텍스트로만 구분되는 요소들
   * (검색 필터 칩, 채널 탭 등). 라벨은 대소문자/공백 무시로 비교한다.
   */
  const textLabels = ['shorts', '쇼츠'];
  const textTargetSelectors = [
    'yt-chip-cloud-chip-renderer',
    'chip-shape',
    'yt-tab-shape',
    'tp-yt-paper-tab',
    'ytd-guide-entry-renderer',
    'ytd-mini-guide-entry-renderer',
    'ytm-chip-cloud-chip-renderer',
    'ytm-pivot-bar-item-renderer',
  ];

  function isYouTubeHost(hostname) {
    return YOUTUBE_HOSTS.includes(String(hostname).toLowerCase());
  }

  /** 주어진 URL(문자열 또는 URL 객체)이 숏츠 페이지인지 판정 */
  function isShortsUrl(url) {
    const u = parseUrl(url);
    return !!u && isYouTubeHost(u.hostname) && SHORTS_PATH_RE.test(u.pathname);
  }

  function parseUrl(url) {
    try {
      return url instanceof URL ? url : new URL(String(url), 'https://www.youtube.com');
    } catch (_) {
      return null;
    }
  }

  /** /watch?v=<id> 페이지면 영상 ID, 아니면 null */
  function watchVideoId(url) {
    const u = parseUrl(url);
    if (!u || !isYouTubeHost(u.hostname) || u.pathname !== '/watch') return null;
    return u.searchParams.get('v') || null;
  }

  /**
   * 숏츠 영상은 /watch?v=<id> 로 열어도 canonical 링크가 /shorts/<id> 를 가리킨다.
   * canonical 이 현재 영상(id)에 대한 것일 때만 판정한다 (SPA 이동 후 낡은 값 방지).
   * @returns {boolean|null} true=숏츠, false=일반 영상, null=판단 불가
   */
  function shortsVerdictFromCanonical(canonicalHref, videoId) {
    const u = parseUrl(canonicalHref);
    if (!u || !videoId) return null;
    if (u.pathname.toLowerCase() === `/shorts/${videoId.toLowerCase()}`) return true;
    if (u.pathname === '/watch' && u.searchParams.get('v') === videoId) return false;
    return null;
  }

  /**
   * 숏츠 여부 확인용 주소. 유튜브는 /shorts/<id> 요청에 대해
   * 숏츠면 200, 일반 영상이면 /watch 로 리다이렉트한다.
   */
  function shortsProbePath(videoId) {
    return `/shorts/${encodeURIComponent(videoId)}`;
  }

  /** 숏츠 URL을 차단할 때 보낼 목적지 (같은 호스트의 메인 페이지) */
  function redirectTarget(url) {
    const u = url instanceof URL ? url : new URL(String(url), 'https://www.youtube.com');
    return `${u.protocol}//${u.host}/`;
  }

  function normalizeLabel(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  // 유튜브는 같은 라벨을 여러 번 렌더링하기도 한다 ("Shorts Shorts").
  // 모든 단어가 숏츠 라벨일 때만 true — "Shorts 더보기" 같은 문구는 제외.
  function isShortsLabel(text) {
    const words = normalizeLabel(text).split(' ').filter(Boolean);
    return words.length > 0 && words.every((w) => textLabels.includes(w));
  }

  /** 플랫폼에 맞는 숨김 셀렉터 목록 */
  function selectorsFor(platform) {
    if (platform === 'desktop') return desktopSelectors.slice();
    if (platform === 'mobile') return mobileSelectors.slice();
    return desktopSelectors.concat(mobileSelectors);
  }

  /** 호스트 이름으로 플랫폼 추정 */
  function platformForHost(hostname) {
    return String(hostname).toLowerCase() === 'm.youtube.com' ? 'mobile' : 'desktop';
  }

  const api = {
    YOUTUBE_HOSTS,
    SHORTS_PATH_RE,
    desktopSelectors,
    mobileSelectors,
    textLabels,
    textTargetSelectors,
    isYouTubeHost,
    isShortsUrl,
    watchVideoId,
    shortsVerdictFromCanonical,
    shortsProbePath,
    redirectTarget,
    isShortsLabel,
    selectorsFor,
    platformForHost,
  };

  root.AntiShorts = Object.assign(root.AntiShorts || {}, { rules: api });
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
