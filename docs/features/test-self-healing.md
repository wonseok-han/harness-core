# Feature Specification: test-self-healing

## 기획 의도 (Intent)
테스트 실패 시 Log Transpiler로 에러를 구조화하고 최대 3회 자동 재시도하는 자가 치유 루프

## 인풋 데이터 (Input)
테스트 설정
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| root | string | Y | 프로젝트 루트 |

## 아웃풋 데이터 (Output)
테스트 결과
| Field | Type | Description |
|-------|------|-------------|
| passed | boolean | 최종 통과 여부 |
| report | TranspiledReport | 에러 리포트 |

## 예외 케이스 (Exceptions)
| Condition | Behavior | Error Code |
|-----------|----------|------------|
| 최대 재시도 초과 | 리포트 저장 후 실패 종료 | HEAL_MAX_RETRY |

## 도메인 용어 참조
- **transpiler** — see domain-glossary.json
- **self-healing** — see domain-glossary.json
