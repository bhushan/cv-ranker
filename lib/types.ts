export type Role = "PM" | "SPM";
export interface RubricCriterion {
  id: string;
  name: string;
  weight: number;
  description: string;
  evaluation_guidance: string;
  source_hires?: string[];
  rationale?: string;
}
export interface Rubric {
  role: Role;
  version: number;
  source: string;
  criteria: RubricCriterion[];
}
export interface CriterionResult {
  criterion_id: string;
  score: number;
  evidence: string;
  reasoning: string;
  confidence: number;
}
export interface CandidateIdentity {
  name: string;
  email: string;
  phone: string;
}
