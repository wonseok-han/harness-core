Claude Code와 같은 자율형 AI 에이전트에게 이 프롬프트를 그대로 입력하여 "범용 AI 하네스 프레임워크 패키지"를 바로 개발할 수 있도록, **소프트웨어 아키텍처 명세서 및 구현 가이드 형태**로 내용을 세세하게 정리했습니다.

이 내용을 마크다운 파일로 저장하거나 그대로 Claude Code에 복사·붙여넣기하여 개발을 지시하시면 됩니다.

---

# 📋 서비스 비종속적 범용 AI 하네스 프레임워크 개발 명세서

**목적:** 어떤 웹 프레임워크(Next.js, Nuxt, Svelte 등)나 디렉토리 구조에서도 작동하며, AI 에이전트의 전체 SDLC 단계를 통제·유효성 검증하는 설정 기반(Configuration-driven) 패키지 개발.

---

## ─── 1. 시스템 아키텍처 및 4대 핵심 엔진 (내부 구조) ───

패키지 내부 코드는 특정 기술 스택에 종속되지 않도록 추상화된 4개의 독립 엔진으로 구성합니다.

### ① 아키텍처 및 환경 추상화 엔진 (Auto-Discovery Engine)

* **기능:** 프로젝트 루트의 `package.json`, `tsconfig.json`, `pnpm-workspace.yaml` 등을 탐색하여 패키지 매니저(pnpm/npm/yarn), 프레임워크, 테스트 도구를 자동 식별.
* **출력:** 탐색된 메타데이터를 기반으로 기본 `harness.config.json` 뼈대 생성 및 프로젝트 맞춤형 `CLAUDE.md`, `.claude/rules` 동적 주입.

### ② 설정 기반 가드레일 엔진 (Policy & Hook Orchestrator)

* **기능:** `harness.config.json`에 선언된 규칙(예: FSD 아키텍처, 서비스 레이어 패턴 등)을 읽어와 동적으로 유효성 검사 스크립트를 생성.
* **출력:** Husky 및 lint-staged와 연동하여 커밋/푸시 시점에 프로젝트 내의 검증 도구(ESLint, Biome, Vitest 등)를 차례로 실행하는 범용 오케스트레이터 구동.

### ③ 범용 에이전트 툴킷 엔진 (Universal Agent Tools - MCP/CLI)

* **기능:** AI 에이전트가 파일 시스템을 무작위로 훼손하지 않도록 '안전한 손발' 역할의 API 및 CLI 제공.
* **출력:** 규칙에 맞는 컴포넌트 구조 및 `index.ts` 자동 생성기(Scaffolder), 다국어 JSON이나 환경 변수(`.env`)를 구문 에러 없이 수정하는 데이터 안전 변경 유틸리티.

### ④ 에이전트 전용 피드백 표준화 엔진 (Log Transpiler)

* **기능:** 터미널의 난해한 빌드/린트/테스트 에러 로그를 가공.
* **출력:** AI가 디버깅하기 가장 좋은 구조화된 마크다운/JSON 포맷(`[에러 원인 / 발생 위치 / 해결 힌트]`)으로 변환하여 AI에게 반환(Self-Healing 유도).

---

## ─── 2. SDLC 5단계 가드레일 및 CLI 명령어 설계 ───

AI 에이전트가 각 단계에서 호출하거나, 시스템 파이프라인에 의해 강제되는 5단계 프로세스 가이드라인입니다.

### 1단계. 계획 (Planning) ─── 명령어: `harness init`

* **AI 가드레일 행위:** 프로젝트 진입 직후 환경 분석 및 최초 네비게이션 주입.
* **세부 기능:**
* 대화형 환경 정의 인터페이스 실행 (프레임워크, 스타일 엔진, 아키텍처 컨벤션 지정).
* AI의 권한 스코프 및 페르소나(예: 시니어 아키텍트 / 주니어 개발자)를 명시한 컨텍스트 파일 자동 구성.



### 2단계. 분석 (Analysis) ─── 명령어: `harness analyze`

* **AI 가드레일 행위:** 요구사항 해석 영역 제한 및 도메인 용어 격리.
* **세부 기능:**
* 서비스 고유 핵심 도메인 단어를 정의하는 `domain-glossary.json` 생성 및 AI 참조 강제.
* AI가 기능 명세서 작성 시 활용할 엄격한 Markdown/JSON Schema 템플릿 제공. [기획 의도 / 인풋-아웃풋 데이터 / 예외 케이스] 누락 시 자동 반려.



### 3단계. 설계 (Design) ─── 명령어: `harness sync`

* **AI 가드레일 행위:** 코드 구현 전 인터페이스 계약 선언 및 아키텍처 토폴로지 동기화.
* **세부 기능:**
* 실제 구현 파일 생성 전, 타입스크립트 인터페이스(`types/`)와 모크 API 데이터(`mocks/`) 레이어를 선언하도록 프로세스 제약.
* 설정 파일의 아키텍처 규칙(예: 레이어 간 참조 제한 규칙)을 `.claude/rules`에 실시간 바인딩하여 설계 이탈 방지.



### 4단계. 개발 (Development) ─── 명령어: 내부 자동화 및 MCP 호출

* **AI 가드레일 행위:** 규격화된 소스코드 자율 구현 및 실시간 검증.
* **세부 기능:**
* AI가 코드 구현 시 `harness generate <type> <name>` 형태의 내장 스캐폴딩 명령어를 사용하도록 가이드하여 디렉토리 표준 강제.
* Husky 오케스트레이터를 통해 커밋 시점에 린터/포맷터/타입체커 강제 실행.



### 5단계. 테스트 (Testing) ─── 명령어: `harness test`

* **AI 가드레일 행위:** 테스트 주도 개발(TDD) 규격 검증 및 자율 디버깅(Self-Healing) 루프 구동.
* **세부 기능:**
* **Test-First Guard:** 구현 코드 변경 시 이에 대응하는 유효한 테스트 파일(`tests/`)이 함께 제출되었는지 검사하여 미제출 시 프로세스 차단.
* **Universal Test Runner:** `harness.config.json`에 정의된 도구(Vitest, Jest, Playwright 등)를 호출하여 테스트 및 최소 커버리지 기준(Coverage Gate) 만족 여부 심사.
* **Self-Healing Loop:** 테스트 실패 시, 4번 엔진(Log Transpiler)을 통해 정제된 에러 리포트 생성 후 AI에게 반환. AI가 인간 개입 없이 자율적으로 코드를 수정하고 테스트를 재수행하도록 무한 디버깅 루프 제공.



---

## ─── 3. 핵심 설정 파일 규격 (`harness.config.json`) ───

패키지가 프로젝트를 해석하는 기준이 되는 설정 파일의 JSON 스키마 예시입니다. 이 스키마를 기준으로 모든 엔진이 동작하도록 개발해야 합니다.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "project": {
    "name": "new-web-service",
    "framework": "nextjs",
    "packageManager": "pnpm",
    "language": "typescript"
  },
  "architecture": {
    "style": "fsd", 
    "enforceIndexGen": true,
    "forbiddenImports": {
      "features/*": ["pages/*", "app/*"],
      "entities/*": ["features/*", "pages/*"]
    }
  },
  "development": {
    "linter": "eslint",
    "formatter": "prettier",
    "styling": "tailwind-v4"
  },
  "testing": {
    "runner": "vitest",
    "minCoverage": {
      "statements": 80,
      "branches": 75,
      "functions": 80,
      "lines": 80
    },
    "requireTestFileWithImplementation": true
  },
  "agent": {
    "persona": "senior-frontend-developer",
    "allowedScopes": ["src/**/*", "tests/**/*", "public/**/*"]
  }
}

```

---

## ─── 4. Claude Code에게 내리는 최종 개발 지시 프롬프트 ───

> **Claude, 위 명세서에 기술된 '범용 AI 하네스 프레임워크 패키지'를 개발해줘. 아래 지구 사항을 준수하며 단계별로 코드를 구현해 나가자.**
> 1. 패키지 이름 규격은 @wonseok-han/harness-core로 명시해서 package.json을 세팅해줘.
> 2. 특정 웹 프레임워크나 도구에 종속되지 않는 **완전한 추상화 레이어**로 설계할 것.
> 3. `harness init` 실행 시 주변 환경을 스캔하여 상기 `harness.config.json` 규격을 생성하고 이에 맞는 `CLAUDE.md`를 빌드하는 코드부터 작성할 것.
> 4. `harness analyze`, `harness sync`, `harness test` 명령어가 동작하는 CLI 환경을 구축할 것.
> 5. 특히 5단계 테스트 파이프라인에서 에러 로그를 마크다운 요약본으로 변환하여 AI 에이전트 자신에게 셀프 힐링(Self-Healing) 컨텍스트로 환류시키는 **Log Transpiler 로직**을 정교하게 만들어줘.
> 6. 개발이 완료되면 이 패키지 자체를 테스트할 수 있는 유닛 테스트 코드도 함께 작성해줘.
>