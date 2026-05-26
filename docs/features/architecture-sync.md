# Feature Specification: architecture-sync

## 기획 의도 (Intent)
config 변경 시 모든 AI 에이전트 설정과 git hooks를 자동 재생성하여 동기화 보장

## 인풋 데이터 (Input)
sync 옵션
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| root | string | Y | 프로젝트 루트 |
| watch | boolean | N | 파일 변경 감시 모드 |

## 아웃풋 데이터 (Output)
동기화 결과
| Field | Type | Description |
|-------|------|-------------|
| violations | ImportViolation[] | import 위반 목록 |

## 예외 케이스 (Exceptions)
| Condition | Behavior | Error Code |
|-----------|----------|------------|
| config 없음 | harness init 안내 | NO_CONFIG |

## 도메인 용어 참조
_No related terms found_
