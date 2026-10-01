import { describe, it, expect } from 'vitest';
import { calculateScore } from '../lib/evaluation/scoring';
import { rankCandidates, shortlist } from '../lib/rankings/ranking';
import { extractIdentity, sanitizeCv, createEvaluationPayload, type SanitizedCv } from '../lib/candidates/pii';
import { validateDocument } from '../lib/documents/validation';

const rubric = { role: 'PM' as const, version: 1, source: 'Eight historical Kargo hires', criteria: [
  { id: 'a', name: 'A', weight: 75, description: '', evaluation_guidance: '' },
  { id: 'b', name: 'B', weight: 25, description: '', evaluation_guidance: '' },
] };
const results = (a: number, b: number) => [a, b].map((score, i) => ({ criterion_id: i ? 'b' : 'a', score, evidence: score ? 'Built a product' : '', reasoning: score ? 'Direct evidence' : 'Evidence unavailable', confidence: 0.9 }));
describe('deterministic scoring', () => {
  it('calculates weighted normal scores without rounding', () => expect(calculateScore(rubric, results(8.333, 4), 'Built a product')).toBeCloseTo(72.4975));
  it('scores zeros', () => expect(calculateScore(rubric, results(0, 0), '')).toBe(0));
  it('scores maximum', () => expect(calculateScore(rubric, results(10, 10), 'Built a product')).toBe(100));
  it('rejects missing criteria and fabricated evidence', () => {
    expect(() => calculateScore(rubric, results(5, 5).slice(0, 1), 'Built a product')).toThrow();
    expect(() => calculateScore(rubric, results(5, 5), 'Different content')).toThrow();
  });
  it('rejects out of range and scores without evidence', () => {
    expect(() => calculateScore(rubric, results(11, 5), 'Built a product')).toThrow();
    expect(() => calculateScore(rubric, [{ ...results(5,5)[0], evidence: '' }, results(5,5)[1]], 'Built a product')).toThrow();
  });
});
describe('ranking', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ id: String(i), overall_score: i, created_at: '2026-01-01' }));
  it('sorts descending and selects five', () => { expect(rankCandidates(rows)[0].id).toBe('6'); expect(shortlist(rows)).toHaveLength(5); });
  it('uses stable tie breakers', () => expect(rankCandidates([{id:'b',overall_score:5,created_at:'2026-01-01'}, {id:'a',overall_score:5,created_at:'2026-01-01'}])[0].id).toBe('a'));
});
describe('PII separation', () => {
  const text = 'Priya Sharma\npriya@example.com\n+91 9876543210\nAddress: Delhi\nLinkedIn: https://linkedin.com/in/priya\nExperience\nBuilt a product that grew revenue 35%.\nGender: Female';
  it('extracts identity separately and excludes it from payload', () => {
    const identity = extractIdentity(text); expect(identity.name).toBe('Priya Sharma');
    const clean = sanitizeCv(text, identity);
    const payload = JSON.stringify(createEvaluationPayload('candidate-1', 'PM', clean, rubric));
    for (const value of ['Priya', 'Sharma', 'priya@example.com', '9876543210', 'Delhi', 'Female', 'linkedin']) expect(payload).not.toContain(value);
    expect(payload).toContain('grew revenue 35%');
  });
  it('fails closed on absent identity', () => expect(() => extractIdentity('Experience\nBuilt a product')).toThrow());
  it('removes entire identifying sections and resumes professional evidence', () => {
    const raw = `${text}\nReferences\nProfessor Ravi Mehta\nSchool Director\nravi@example.com\nAddress\nFlat 12, Rose Apartments\nBengaluru 560001\nEducation\nSouth University\nBachelor degree 2015\nPersonal Details\nFather: Arun Sharma\nBirthplace: Mumbai\nProjects\nBuilt a logistics dashboard that reduced operational delays 20%.\nportfolio.example.org/priya`;
    const clean=sanitizeCv(raw,extractIdentity(raw));
    for (const value of ['Ravi','Mehta','Flat','Rose','Bengaluru','560001','South','Bachelor','Arun','Mumbai','example.org']) expect(clean).not.toContain(value);
    expect(clean).toContain('reduced operational delays 20%');
  });
  it('removes standalone names, addresses and locations in professional sections', () => {
    const raw=`${text}\nProfessor Ravi Mehta\nFlat 12, Rose Apartments\nBengaluru\n560001\nExperience\nOwned product discovery and grew activation by 25%.`;
    const clean=sanitizeCv(raw,extractIdentity(raw));
    for (const value of ['Ravi','Mehta','Flat','Rose','Bengaluru','560001']) expect(clean).not.toContain(value);
    expect(clean).toContain('activation by 25%');
  });
  it('rejects bypassed sanitizer and strips source-person metadata', () => {
    expect(()=>createEvaluationPayload('x','PM',text as SanitizedCv,rubric)).toThrow();
    const clean=sanitizeCv(text,extractIdentity(text));
    const namedRubric={...rubric,source:'Historical Arun Singh CV',criteria:rubric.criteria.map(c=>({...c,source_hires:['Arun Singh'],rationale:'Arun Singh succeeded'}))};
    const payload=JSON.stringify(createEvaluationPayload('x','PM',clean,namedRubric));
    expect(payload).not.toContain('Arun'); expect(payload).not.toContain('source_hires'); expect(payload).not.toContain('rationale');
  });
});
describe('document validation', () => {
  it('rejects spoofed documents and oversize files', () => {
    expect(() => validateDocument('cv.pdf', Buffer.from('not pdf'))).toThrow();
    expect(() => validateDocument('cv.pdf', Buffer.alloc(4 * 1024 * 1024 + 1))).toThrow();
  });
});
