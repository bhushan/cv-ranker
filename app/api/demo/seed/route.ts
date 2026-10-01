import { api } from '@/lib/api';
import { seedSyntheticCandidates } from '@/lib/candidates/seed';
export const maxDuration=120;
export async function POST(request:Request) {return api(request,()=>seedSyntheticCandidates());}
