// 가짜 window/document 로 차단 엔진의 리다이렉트 판단을 검증한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rules = require('../src/core/rules.js');
const blocker = require('../src/core/blocker.js');

const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeEnv({ href, canonical = null, probe = null }) {
  const replaced = [];
  const fetched = [];
  const node = () => ({ appendChild() {}, querySelectorAll: () => [], hasAttribute: () => false });
  const doc = {
    readyState: 'complete',
    head: node(),
    documentElement: node(),
    getElementById: () => null,
    createElement: () => ({}),
    querySelector: (sel) => (sel === 'link[rel="canonical"]' && canonical ? { href: canonical } : null),
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const win = {
    document: doc,
    location: { href, hostname: new URL(href).hostname, replace: (u) => replaced.push(u) },
    addEventListener() {},
    setInterval() {},
    setTimeout,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    MutationObserver: class { observe() {} },
    fetch: async (url, opts) => {
      fetched.push([url, opts.method]);
      return probe;
    },
  };
  blocker.start({ window: win, document: doc, rules });
  return { replaced, fetched };
}

test('/shorts/ URL 은 즉시 메인으로', () => {
  const env = fakeEnv({ href: 'https://www.youtube.com/shorts/abc' });
  assert.deepEqual(env.replaced, ['https://www.youtube.com/']);
});

test('canonical 이 /shorts/ 인 /watch 영상은 메인으로', async () => {
  const env = fakeEnv({
    href: 'https://www.youtube.com/watch?v=NRlfZAKXuFE',
    canonical: 'https://www.youtube.com/shorts/NRlfZAKXuFE',
  });
  await tick();
  assert.deepEqual(env.replaced, ['https://www.youtube.com/']);
  assert.equal(env.fetched.length, 0);
});

test('canonical 이 없으면 HEAD /shorts/<id> 로 확인 — 숏츠', async () => {
  const env = fakeEnv({
    href: 'https://www.youtube.com/watch?v=NRlfZAKXuFE',
    probe: { ok: true, status: 200, type: 'basic' },
  });
  await tick(); await tick();
  assert.deepEqual(env.fetched, [['/shorts/NRlfZAKXuFE', 'HEAD']]);
  assert.deepEqual(env.replaced, ['https://www.youtube.com/']);
});

test('일반 영상은 그대로 둔다', async () => {
  const env = fakeEnv({
    href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    probe: { ok: false, status: 0, type: 'opaqueredirect' },
  });
  await tick(); await tick();
  assert.equal(env.fetched.length, 1);
  assert.deepEqual(env.replaced, []);
});
