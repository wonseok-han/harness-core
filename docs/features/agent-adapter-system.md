# Feature Specification: agent-adapter-system

## 기획 의도 (Intent)
다양한 AI 에이전트에 대해 각자의 규칙 파일 형식으로 guardrail을 주입하는 확장 가능한 어댑터 시스템

## 인풋 데이터 (Input)
harness 설정
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| config | HarnessConfig | Y | 설정 내용 |
| adapterType | AgentType | Y | 대상 AI 에이전트 |

## 아웃풋 데이터 (Output)
에이전트별 설정 파일
| Field | Type | Description |
|-------|------|-------------|
| files | Record<string,string> | 생성된 파일 맵 |

## 예외 케이스 (Exceptions)
| Condition | Behavior | Error Code |
|-----------|----------|------------|
| 미지원 에이전트 | generic 어댑터 폴백 | UNKNOWN_AGENT |

## 도메인 용어 참조
- **adapter** — see domain-glossary.json
- **guardrail** — see domain-glossary.json
