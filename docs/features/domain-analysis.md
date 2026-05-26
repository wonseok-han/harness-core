# Feature Specification: domain-analysis

## 기획 의도 (Intent)
도메인 용어와 기능 스펙을 정의하여 AI가 프로젝트 맥락을 정확히 이해할 수 있게 하는 분석 단계

## 인풋 데이터 (Input)
분석 입력
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| scanMode | boolean | N | 프로젝트 정적 분석 모드 |
| fromFile | string | N | 사전 작성 JSON 파일 경로 |

## 아웃풋 데이터 (Output)
분석 산출물
| Field | Type | Description |
|-------|------|-------------|
| glossary | DomainGlossary | domain-glossary.json |

## 예외 케이스 (Exceptions)
| Condition | Behavior | Error Code |
|-----------|----------|------------|
| JSON 파싱 실패 | 에러 출력 후 종료 | INVALID_JSON |

## 도메인 용어 참조
_No related terms found_
