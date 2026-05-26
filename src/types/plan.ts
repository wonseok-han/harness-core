export interface PlanSpec {
  goal: string;
  features: PlannedFeature[];
  milestones?: Milestone[];
}

export interface PlannedFeature {
  name: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  dependencies?: string[];
  milestone?: string;
}

export interface Milestone {
  name: string;
  targetDate?: string;
  features: string[];
}
