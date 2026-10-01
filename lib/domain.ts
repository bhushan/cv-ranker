import type { Rubric, CriterionResult, Role } from './types';
export type { Role, Rubric, CriterionResult };
export type Evaluation = { role: Role; rubric_version: number; overall_score: number; criteria: CriterionResult[]; status: string };
export type EmailDraft = { id: string; candidate_id: string; type: 'INVITATION' | 'REJECTION'; subject: string; body: string; status: string; approved_at?: string | null; sent_at?: string | null; resend_id?: string | null; error?: string | null; updated_at?: string };
export type Candidate = { id: string; applied_role: Role; status: string; created_at: string; identity: {name: string; email: string; phone: string}; evaluations: Evaluation[]; briefs: Partial<Record<Role, string>>; email: EmailDraft | null; job?: {stage: string; error: string | null} };
export type DashboardData = { candidates: Candidate[]; rubrics: Rubric[]; mode: 'demo' | 'live'; configured: boolean };
