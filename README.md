# fromlilo

fromlilo 사이트와 업무 자동화 툴을 함께 관리하는 단일 최신 저장소입니다.

## 기준 저장소

- 로컬 경로: `/Users/lilo/fromlilo`
- GitHub 원격: `https://github.com/Liloshare/fromlilo.git`
- 배포 프로젝트: `.openai/hosting.json`

예전 `/Users/lilo/fromlilo.com` 저장소의 랜딩/서비스 문서는 이 저장소에 합쳐져 있습니다. 앞으로는 이 저장소만 수정합니다.

## 주요 경로

- `index.html`, `styles.css`, `script.js`: 메인 랜딩 페이지
- `tools/`: BBox QC 툴
- `ai-services/`: AI 서비스 기획 문서
- `automation-tools/`: 자동화 툴 기획 문서
- `shop/`: 쇼핑몰 기획 문서

## 실행

브라우저에서 `index.html`을 직접 열거나, 로컬 서버로 확인합니다.

```bash
python3 -m http.server 4173
```

그 다음 `http://localhost:4173`으로 접속합니다.
