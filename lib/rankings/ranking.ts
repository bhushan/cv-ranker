export interface RankedInput { id: string; overall_score: number; created_at: string }
export function rankCandidates<T extends RankedInput>(rows: readonly T[]): (T & {rank: number})[] {
  return [...rows].sort((a,b)=>b.overall_score-a.overall_score || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map((row,i)=>({...row,rank:i+1}));
}
export function shortlist<T extends RankedInput>(rows: readonly T[]) { return rankCandidates(rows).slice(0,5); }
