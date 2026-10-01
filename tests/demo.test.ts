import { describe,it,expect } from 'vitest';
import { getDemoData } from '../lib/demo';
import { shortlist } from '../lib/rankings/ranking';
import { calculateScore } from '../lib/evaluation/scoring';
describe('one-minute synthetic demonstration',()=>{
 it('has both validated weighted evaluations for every candidate',()=>{
  const data=getDemoData();
  expect(data.candidates.length).toBeGreaterThan(5);
  for(const c of data.candidates) for(const r of data.rubrics){const e=c.evaluations.find(e=>e.role===r.role)!;expect(e).toBeDefined();expect(e.overall_score).toBe(calculateScore(r,e.criteria,e.criteria.map(x=>x.evidence).join('\n')));}
 });
 it('provides exactly three sentences per role shortlist, invitations for their union and rejections outside it',()=>{
  const data=getDemoData();const selected=new Set<string>();
  for(const role of ['PM','SPM'] as const) for(const c of shortlist(data.candidates.map(c=>({...c,overall_score:c.evaluations.find(e=>e.role===role)!.overall_score})))){selected.add(c.id);expect(c.briefs[role]?.match(/[.!?](?:\s|$)/g)).toHaveLength(3);}
  expect(data.candidates.some(c=>!selected.has(c.id))).toBe(true);
  for(const c of data.candidates){expect(c.email?.type).toBe(selected.has(c.id)?'INVITATION':'REJECTION');expect(c.email?.status).toBe('PENDING_REVIEW');expect(c.email?.body).not.toMatch(/score|ranking|rubric|AI reasoning/i);expect(c.identity.email).toMatch(/@example\.com$/);}
 });
});
