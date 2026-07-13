# 바로PDF (BaroPDF) — 설계 문서

## 한 줄 정의
PDF 합치기·분할·압축·변환을 **전부 사용자 브라우저 안에서** 처리하는 정적 도구 사이트.
파일이 PC를 떠나지 않는다.

## 핵심 원칙
1. **파일 무전송** — 어떤 파일도 서버로 가지 않는다. 네트워크 요청은 정적 자산 로딩(및 광고/GA)뿐.
   모든 페이지 최상단(privacy-badge)과 푸터에 명시한다.
2. **무제한 무료** — 서버 비용이 없으므로 용량 제한·횟수 제한·워터마크 없음.
3. **절대 안 깨짐** — 처리 실패 시 원본 보존 + 한국어 사용자 친화 에러 메시지.
   파일 미선택 / 손상 PDF / 암호 PDF를 구분해 안내한다 (`js/engine/errors.js`).
4. **엔진 검증** — 코어 로직은 Node에서 실제 PDF fixture로 단위 테스트한다 (62개).

## 제약 조건
- GitHub Pages 단독 배포, 빌드 도구 0, 유지비 0원. Vanilla JS ES modules, 라이트 테마, 한국어 UI.
- 라이브러리는 vendor/ 에 고정 버전 커밋:
  - pdf-lib 1.17.1 (UMD) — PDF 조작
  - pdfjs-dist 4.10.38 legacy build (+worker) — 렌더링
- 런타임 CDN 의존 금지 (쿠팡 광고·GA 스크립트 제외).
- 무거운 처리는 Web Worker에서 실행, transferable ArrayBuffer 사용, 진행률 postMessage.

## 아키텍처

```
index.html + 6개 도구 HTML (정적, SEO 완결)
   │  <script type="module" src="js/pages/*.js">
   ▼
js/pages/*.js   페이지별 오케스트레이션 (DOM ↔ 서비스)
js/ui/*.js      dropzone, filelist, progress, download,
                worker-client(Promise 래퍼), render-fallback(렌더 서비스)
   │  postMessage({id, cmd, payload}) / transferable
   ▼
worker.js       module worker — 명령 디스패치
                merge / extract / splitAll / imagesToPdf / organize /
                compress / render / assemble / inspect
   │
js/engine/*.js  pdf-lib·pdf.js 주입식(DI) 엔진 — Worker와 Node 양쪽에서 동작
js/core/*.js    순수 로직(DOM 0): range-parser, crc32, zip(STORE), filename, paper, format
```

### 설계 결정
- **DI(의존성 주입)**: engine 모듈은 `PDFLib`/`pdfjsLib`/캔버스 어댑터를 인자로 받는다.
  → Node 테스트에서는 UMD를 `new Function`으로 로드해 주입, Worker에서는 self.PDFLib 주입.
- **렌더링 이중화**: OffscreenCanvas 지원 브라우저는 Worker에서 렌더링,
  미지원 브라우저는 메인 스레드 폴백(`render-fallback.js`) — pdf.js 자체 워커가 파싱을 담당하므로
  UI 블로킹은 캔버스 드로잉뿐이다.
- **ZIP은 STORE(무압축)**: JPG/PDF는 이미 압축된 데이터라 deflate 이득이 없고,
  CRC32만 정확하면 무결성이 보장된다. 자체 구현 60줄로 의존성 0.
- **불변 상태**: 파일 목록·썸네일 셀 배열은 항상 새 배열로 교체(map/filter/spread).

## 도구 구성 (페이지 = 검색 키워드 1:1)
| 페이지 | 키워드 | 엔진 경로 |
|---|---|---|
| merge.html | PDF 합치기 | worker: merge |
| split.html | PDF 분할/추출 ("1-3,5,7-") | core: range-parser → worker: extract/splitAll (+zip) |
| compress.html | PDF 용량 줄이기 | worker: compress (render→JPEG→재조립), 품질 3단 |
| pdf-to-jpg.html | PDF JPG 변환 | 렌더 서비스 → 1장 JPG / 여러 장 ZIP(STORE) |
| jpg-to-pdf.html | 사진을 PDF로 | core: paper(mm→pt, 배치) → worker: imagesToPdf |
| organize.html | 페이지 순서·회전·삭제 | 렌더 서비스(썸네일) → worker: organize |
| index.html | 허브 + 신뢰 섹션 | — |

## 완성 기준 체크
- [x] 6도구 HTML + 허브 + 404 (총 8 HTML, sitemap에는 콘텐츠 7페이지)
- [x] Node 테스트 62개 전부 통과 (`node tests/run-all.mjs`)
- [x] 모든 JS `node --check` 통과
- [x] SEO: 페이지별 title/desc/canonical/OG/JSON-LD(SoftwareApplication+FAQPage), sitemap, robots
- [x] 광고(하단 정적+가드, 양옆 레일) + GA4(G-2P73L29BH7) 전 페이지
- [x] 모바일 반응형(760px), prefers-reduced-motion 대응
- [ ] maestro24.github.io/baropdf 배포 및 라이브 검증 (오케스트레이터 담당)

## 수익/성장
쿠팡 파트너스(하단 배너 + 양옆 캐러셀 레일, 로드 실패 가드) → 추후 AdSense.
마케팅 없음, 검색 유기 유입 전제.
