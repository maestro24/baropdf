# 바로PDF (BaroPDF)

브라우저 완결 PDF 도구 사이트. **파일이 서버로 전송되지 않는다** — 모든 처리는
사용자 브라우저의 메모리 안에서 pdf-lib / PDF.js 로 수행된다.

- 배포: https://maestro24.github.io/baropdf/ (GitHub Pages, 정적 호스팅)
- 스택: HTML + Vanilla JS(ES modules) + CSS. 빌드 도구·프레임워크 없음.

## 구조

```
baropdf/
├── index.html            허브 + 기술 신뢰 섹션
├── merge.html            PDF 합치기 (다중 파일, 순서 변경)
├── split.html            PDF 분할/추출 (범위 파서 "1-3,5,7-")
├── compress.html         PDF 용량 줄이기 (렌더→JPEG 재인코딩, 품질 3단)
├── pdf-to-jpg.html       PDF → JPG (해상도 선택, 여러 장 ZIP)
├── jpg-to-pdf.html       JPG/PNG → PDF (A4/Letter/원본, 여백)
├── organize.html         페이지 순서 변경·회전·삭제 (썸네일 드래그)
├── 404.html / robots.txt / sitemap.xml
├── worker.js             module Web Worker — 명령 디스패치, transferable
├── css/style.css         디자인 시스템 (라이트 전용, 레드 액센트 #e0433e)
├── vendor/               고정 버전 라이브러리 (커밋됨, CDN 런타임 의존 없음)
│   ├── pdf-lib.min.js            pdf-lib 1.17.1 UMD
│   ├── pdf.min.mjs               pdfjs-dist 4.10.38 legacy
│   └── pdf.worker.min.mjs
├── js/
│   ├── core/             순수 로직 (DOM 0, Node 테스트 대상)
│   ├── engine/           pdf-lib/pdf.js 주입식 엔진 (Worker·Node 양용)
│   ├── ui/               드롭존·파일리스트·진행률·다운로드·워커 클라이언트
│   └── pages/            페이지별 진입 모듈
├── tests/                Node 단위 테스트 (assert 기반, 러너 포함)
└── docs/PLAN.md          설계 문서
```

## 테스트

```bash
node tests/run-all.mjs        # 전체 (62개)
node tests/range-parser.test.mjs   # 개별 파일 실행도 가능
```

- 범위 파서 전수(경계·역순·중복·초과·빈 입력), CRC32 알려진 벡터, ZIP 구조 무결성,
  파일명 생성, 용지 계산, 그리고 **실제 PDF fixture**로 merge/split/organize/이미지 변환 검증.
- pdf-lib UMD는 `tests/helpers/pdf-lib-loader.mjs`가 Node에서 로드한다.

## 유지 규칙

1. **파일 무전송 원칙 유지** — 파일 데이터를 외부로 보내는 코드를 절대 추가하지 않는다.
   네트워크 요청 허용 범위: 정적 자산, GA4, 쿠팡 광고 스크립트뿐.
2. **vendor 고정** — 라이브러리 업그레이드 시 vendor/ 파일 교체 후 전체 테스트 + 6도구 수동 확인.
3. **core는 순수하게** — js/core/* 에 DOM/Worker API를 넣지 않는다 (Node 테스트가 깨진다).
4. **엔진은 주입식** — js/engine/* 은 PDFLib/pdfjsLib를 인자로 받는다. 전역 참조 금지.
5. **에러는 한국어로** — 사용자에게 보이는 모든 실패 메시지는 `js/engine/errors.js` 경유
   또는 도메인 메시지(페이지 수 초과 등)로. 원본 파일은 어떤 실패에서도 손상되지 않는다.
6. **파일 800줄 미만**, 불변 패턴(배열 교체) 유지.
7. 새 페이지 추가 시: canonical/OG/JSON-LD + sitemap.xml + 각 페이지 푸터 링크 + GA4 + 광고 삽입.
