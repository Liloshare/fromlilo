# Vision QC → Google Slides Sync

Vision QC의 `SYNC SLIDES` 버튼은 현재까지 쌓인 이슈(missing/checking/consis/comment)를
프로젝트별 Google Slides 프레젠테이션 한 개로 생성/업데이트합니다.

흐름: `Vision QC (브라우저)` → `/api/sync-slides` (Cloudflare Pages Function) → `Google Slides API` + `Google Drive API`

- 이슈가 있는 이미지 1장 = 슬라이드 1장
- 슬라이드 본문에는 박스/화살표가 그려진 이미지가, 스피커 노트에는 파일명·이슈 타입·코멘트가 들어갑니다
- 같은 프로젝트 ID로 다시 SYNC하면 같은 이미지의 슬라이드는 새로 그려서 교체되고, 새 이슈는 새 슬라이드로 추가됩니다

## 1. Google Cloud 프로젝트 준비

1. https://console.cloud.google.com 에서 프로젝트 생성 (또는 기존 프로젝트 선택)
2. **API 및 서비스 → 라이브러리**에서 아래 두 API를 각각 검색해 **사용 설정**
   - `Google Slides API`
   - `Google Drive API`

## 2. OAuth 동의 화면

**API 및 서비스 → OAuth 동의 화면**

- User Type: `외부(External)` 선택 후 게시 상태는 `테스트` 그대로 둬도 됩니다 (본인 계정만 사용)
- 범위(Scopes)에 아래 두 개 추가:
  - `https://www.googleapis.com/auth/presentations`
  - `https://www.googleapis.com/auth/drive.file`
- 테스트 사용자에 본인 Google 계정(예: 슬라이드를 만들 계정) 추가

## 3. OAuth 클라이언트 발급

**API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**

- 애플리케이션 유형: `웹 애플리케이션`
- 승인된 리디렉션 URI에 추가:
  ```
  https://developers.google.com/oauthplayground
  ```
- 생성 후 나오는 **클라이언트 ID / 클라이언트 보안비밀**을 기록해둡니다

## 4. Refresh Token 발급 (OAuth Playground)

서버가 사용자 로그인 없이 계속 슬라이드를 갱신할 수 있도록, 최초 1회만 본인 계정으로
로그인해서 refresh token을 발급받습니다. 이후에는 이 토큰으로 서버가 자동 갱신합니다.

1. https://developers.google.com/oauthplayground 접속
2. 오른쪽 위 톱니바퀴(설정) 클릭 → `Use your own OAuth credentials` 체크 → 3번에서 만든 클라이언트 ID/보안비밀 입력
3. 왼쪽 Step 1에서 아래 두 스코프를 직접 입력란에 붙여넣고 `Authorize APIs` 클릭
   ```
   https://www.googleapis.com/auth/presentations
   https://www.googleapis.com/auth/drive.file
   ```
4. 슬라이드를 만들 본인 Google 계정으로 로그인 및 동의
5. Step 2에서 `Exchange authorization code for tokens` 클릭
6. 화면에 나오는 **Refresh token** 값을 복사 (Access token은 짧게 만료되므로 필요 없음)

## 5. Drive 폴더 준비

1. Google Drive에서 슬라이드를 모아둘 폴더 생성 (예: `Vision QC`)
2. 폴더를 열고 주소창의 URL에서 폴더 ID 복사
   ```
   https://drive.google.com/drive/folders/<이 부분이 폴더 ID>
   ```

## 6. Cloudflare 환경변수 등록

fromlilo Pages 프로젝트 → **Settings → Environment variables**에서 아래 4개를
**Encrypt** 옵션으로 등록합니다 (Production 환경 기준):

| 이름 | 값 |
|---|---|
| `GOOGLE_CLIENT_ID` | 3번에서 만든 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | 3번에서 만든 클라이언트 보안비밀 |
| `GOOGLE_REFRESH_TOKEN` | 4번에서 발급받은 refresh token |
| `GOOGLE_SLIDES_FOLDER_ID` | 5번에서 복사한 Drive 폴더 ID |

wrangler CLI를 쓴다면:

```bash
wrangler pages secret put GOOGLE_CLIENT_ID
wrangler pages secret put GOOGLE_CLIENT_SECRET
wrangler pages secret put GOOGLE_REFRESH_TOKEN
wrangler pages secret put GOOGLE_SLIDES_FOLDER_ID
```

## 7. D1 스키마 반영

`db/schema.sql`에 `slides_projects`, `slides_pages` 테이블이 추가되어 있습니다.
기존 `review_results`와 같은 `DB` 바인딩을 사용하므로, 별도 바인딩 설정 없이
아래처럼 스키마만 적용하면 됩니다.

```bash
wrangler d1 execute <DB_NAME> --file=db/schema.sql --remote
```

(D1 바인딩이 없으면 `/api/sync-slides`는 슬라이드는 정상 생성하되, 어떤 이미지가
어떤 슬라이드인지 기억하지 못해 SYNC할 때마다 새 슬라이드가 계속 추가됩니다.)

## 8. 확인

Vision QC에서 이슈를 몇 개 만든 뒤 `SYNC SLIDES` 버튼을 누르면:

1. 프로젝트 ID를 물어봅니다 (R2 `CLOUD` 프로젝트를 불러온 상태면 자동으로 그 ID 사용)
2. 완료되면 생성/업데이트된 프레젠테이션 링크를 열지 물어봅니다

문제가 있으면 브라우저 콘솔과 Cloudflare Pages Functions 로그(`sync_slides_error`)를 확인하세요.
