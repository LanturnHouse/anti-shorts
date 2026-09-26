// 크롬 확장 진입점: 공용 코어(core/rules.js, core/blocker.js)를 시작시키기만 한다.
// 차단을 끄는 옵션은 의도적으로 두지 않는다 — 해제하려면 chrome://extensions 에서
// 확장 프로그램 자체를 끄거나 삭제해야 한다.
globalThis.AntiShorts.blocker.start();
