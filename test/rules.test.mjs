import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const rules = createRequire(import.meta.url)('../src/core/rules.js');

test('숏츠 URL 판정', () => {
  for (const url of [
    'https://www.youtube.com/shorts/abc123',
    'https://www.youtube.com/shorts/abc123?feature=share',
    'https://youtube.com/shorts/',
    'https://m.youtube.com/shorts/abc123',
    'https://www.youtube.com/shorts',
    '/shorts/abc123',
  ]) assert.equal(rules.isShortsUrl(url), true, url);

  for (const url of [
    'https://www.youtube.com/',
    'https://www.youtube.com/watch?v=abc123',
    'https://www.youtube.com/@channel/shorts', // 채널 탭은 요소 숨김으로 처리
    'https://www.youtube.com/shortsfoo',
    'https://example.com/shorts/abc',
    'not a url ::',
  ]) assert.equal(rules.isShortsUrl(url), false, url);
});

test('리다이렉트 목적지는 같은 호스트의 메인', () => {
  assert.equal(rules.redirectTarget('https://www.youtube.com/shorts/x'), 'https://www.youtube.com/');
  assert.equal(rules.redirectTarget('https://m.youtube.com/shorts/x'), 'https://m.youtube.com/');
});

test('Shorts 라벨 판정', () => {
  assert.equal(rules.isShortsLabel('  Shorts \n'), true);
  assert.equal(rules.isShortsLabel('쇼츠'), true);
  assert.equal(rules.isShortsLabel('Shorts\n   \n    Shorts'), true);
  assert.equal(rules.isShortsLabel('Shorts 더보기'), false);
  assert.equal(rules.isShortsLabel('동영상'), false);
});

test('플랫폼별 셀렉터', () => {
  assert.equal(rules.platformForHost('m.youtube.com'), 'mobile');
  assert.equal(rules.platformForHost('www.youtube.com'), 'desktop');
  assert.ok(rules.selectorsFor('desktop').length > 0);
  assert.ok(rules.selectorsFor('mobile').length > 0);
});

test('/watch 영상 ID 추출', () => {
  assert.equal(rules.watchVideoId('https://www.youtube.com/watch?v=NRlfZAKXuFE&t=3'), 'NRlfZAKXuFE');
  assert.equal(rules.watchVideoId('https://youtube.com/watch?v=abc'), 'abc');
  assert.equal(rules.watchVideoId('https://www.youtube.com/watch'), null);
  assert.equal(rules.watchVideoId('https://www.youtube.com/shorts/abc'), null);
  assert.equal(rules.watchVideoId('https://example.com/watch?v=abc'), null);
});

test('canonical 링크로 숏츠 판정', () => {
  const v = 'NRlfZAKXuFE';
  assert.equal(rules.shortsVerdictFromCanonical('https://www.youtube.com/shorts/NRlfZAKXuFE', v), true);
  assert.equal(rules.shortsVerdictFromCanonical('https://www.youtube.com/watch?v=NRlfZAKXuFE', v), false);
  // SPA 이동 후 남아 있는 다른 영상의 canonical 은 무시
  assert.equal(rules.shortsVerdictFromCanonical('https://www.youtube.com/shorts/other', v), null);
  assert.equal(rules.shortsVerdictFromCanonical('https://www.youtube.com/watch?v=other', v), null);
  assert.equal(rules.shortsVerdictFromCanonical('', v), null);
});

test('목록 전체를 감싸는 컨테이너는 숨기지 않는다', () => {
  // 이 요소들은 추천 목록·검색 결과 전체를 감싼다. :has() 로 숨기면 목록이 통째로 사라진다.
  const containers = [
    'ytd-item-section-renderer',
    'ytm-item-section-renderer',
    'ytd-section-list-renderer',
    'ytm-section-list-renderer',
    'ytd-watch-next-secondary-results-renderer',
    'ytd-rich-grid-renderer',
  ];
  for (const sel of rules.selectorsFor('all')) {
    const head = sel.split(/[:\[\s]/)[0];
    assert.ok(!containers.includes(head), `목록 컨테이너를 숨기는 셀렉터: ${sel}`);
  }
});
