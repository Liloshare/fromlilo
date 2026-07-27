# Automation Tools

QC / Review / File Check / Delivery Prep

## Tools

- `tools/joseon-bbox-qc/`: 조선 BBox QC Tool
  - 현재 방식: 브라우저에서 로컬 이미지 폴더와 YOLO 라벨 폴더를 선택해 검수
  - 다음 목표: Cloudflare R2/D1/Worker 기반으로 온라인 데이터 불러오기와 검수 결과 저장 지원

## Local Preview

정적 HTML 도구라서 루트 `index.html`을 브라우저로 열면 됩니다.

```bash
open index.html
```

## Git Workflow

다른 컴퓨터에서 이어서 작업할 때:

```bash
git clone https://github.com/Liloshare/data-qc.git
cd data-qc
```

작업 시작 전:

```bash
git pull
```

작업 종료 후:

```bash
git status
git add .
git commit -m "Update tools"
git push
```

## Codex Handoff

새 세션이나 다른 컴퓨터에서 Codex에게 먼저 요청할 것:

```text
README.md, WORKLOG.md, TODO.md 읽고 이어서 작업해줘.
```
