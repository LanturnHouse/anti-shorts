# anti-shorts

YouTube Shorts를 **끌 수 없게** 차단하는 프로젝트입니다.
확장 프로그램 안에 on/off 스위치는 없습니다. 차단을 풀려면 `chrome://extensions`에서 확장 프로그램을 끄거나 삭제해야 합니다.

## 차단하는 것 (PC 크롬)

| 위치 | 방법 |
| --- | --- |
| 왼쪽 사이드바 / 미니 사이드바의 Shorts | CSS 숨김 |
| 홈·구독·검색 결과의 Shorts 선반 | CSS 숨김 |
| 피드·추천·알림·재생목록 속 개별 Shorts 영상 | CSS 숨김 (`/shorts` 링크나 SHORTS 배지가 있는 카드) |
| 검색 필터의 "Shorts" 칩, 채널의 "Shorts" 탭 | 텍스트 매칭 후 숨김 |
| 주소창·외부 링크로 `/shorts/...` 열기 | `declarativeNetRequest`로 요청 단계에서 `youtube.com/`으로 리다이렉트 |
| 유튜브 내부에서 Shorts 링크 클릭 | 클릭을 캡처 단계에서 차단 |
| `/watch?v=<id>`로 열린 Shorts 영상 | `canonical` 링크가 `/shorts/<id>`인지 확인하고, 판단이 안 되면 `HEAD /shorts/<id>` 요청(Shorts면 200, 일반 영상이면 리다이렉트)으로 판별한 뒤 메인으로 |
| 그 밖의 SPA 이동으로 `/shorts/` 도달 | Navigation API, `yt-navigate-*` 이벤트, 1초 주기 검사 후 메인으로 `location.replace` |

## 설치 (개발 버전)

```bash
npm run build
```

1. 크롬에서 `chrome://extensions` 열기
2. 오른쪽 위 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** → `dist/chrome` 폴더 선택

코드를 고친 뒤에는 `npm run build`를 다시 실행하고, 확장 프로그램 카드의 새로고침 버튼을 누릅니다.

## 구조

```
src/
  core/                 플랫폼 독립 코드
    rules.js            URL 판정, 숨길 셀렉터(PC/모바일), 텍스트 라벨. 순수 데이터와 함수
    blocker.js          window/document만 쓰는 차단 엔진. chrome.* API 사용 금지
  platforms/
    chrome/             크롬 전용 코드
      manifest.json
      content.js        core를 시작시키는 진입점 (한 줄)
      dnr-rules.json    /shorts 요청 리다이렉트 규칙
scripts/build.mjs       core와 플랫폼 파일을 dist/<platform>/ 으로 합침
test/                   node:test 단위 테스트 (npm test)
```

**유튜브가 화면 구조를 바꿔 Shorts가 다시 보이면** 대부분 `src/core/rules.js`의 셀렉터 목록만 고치면 됩니다.

## 범위

PC 크롬 전용으로 마무리한 프로젝트입니다. 모바일 버전(공식 앱, ReVanced 패치 등)은 검토 후 진행하지 않기로 했습니다.
`rules.js`의 `mobileSelectors`는 PC 크롬에서 `m.youtube.com`을 열 때를 위해 남겨 두었습니다.
