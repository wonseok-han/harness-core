export interface DesignSpec {
  feature: string;
  interfaces: InterfaceDef[];
  mocks?: MockDef[];
  apiContracts?: ApiContract[];
}

export interface InterfaceDef {
  name: string;
  description: string;
  properties: Record<string, PropertyDef>;
}

export interface PropertyDef {
  type: string;
  required: boolean;
  description: string;
}

export interface MockDef {
  name: string;
  interfaceName: string;
  data: Record<string, unknown>;
}

export interface ApiContract {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  requestBody?: string;
  responseBody: string;
}
