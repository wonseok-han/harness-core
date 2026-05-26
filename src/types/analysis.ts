export interface AnalysisSpec {
  feature: string;
  intent: string;
  input: DataSchema;
  output: DataSchema;
  exceptions: ExceptionCase[];
}

export interface DataSchema {
  description: string;
  fields: Record<string, FieldDef>;
}

export interface FieldDef {
  type: string;
  required: boolean;
  description: string;
}

export interface ExceptionCase {
  condition: string;
  behavior: string;
  errorCode?: string;
}

export interface DomainGlossary {
  domain: string;
  terms: Record<string, DomainTerm>;
}

export interface DomainTerm {
  definition: string;
  aliases?: string[];
  context?: string;
}
