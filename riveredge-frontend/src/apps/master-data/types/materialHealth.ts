export type MaterialHealthCategory =
  | 'completeness'
  | 'reasonableness'
  | 'duplicate_many_one_code'
  | 'duplicate_one_many_codes'
  | 'duplicate_similar';

export type MaterialHealthSeverity = 'error' | 'warning' | 'info';

export interface MaterialHealthMaterialRef {
  uuid: string;
  mainCode: string;
  name: string;
  specification?: string | null;
}

export interface MaterialHealthIssue {
  id: string;
  category: MaterialHealthCategory;
  severity: MaterialHealthSeverity;
  title: string;
  description: string;
  materials: MaterialHealthMaterialRef[];
  field?: string | null;
}

export interface MaterialHealthSummary {
  totalMaterials: number;
  issueCount: number;
  completenessCount: number;
  duplicateCount: number;
  healthScore: number;
}

export interface MaterialHealthCheckResult {
  summary: MaterialHealthSummary;
  issues: MaterialHealthIssue[];
}

export interface MaterialHealthCheckParams {
  groupId?: number;
  mastersOnly?: boolean;
}
