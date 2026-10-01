import { api } from '@/lib/api';
import { getDashboard,candidateIdSchema } from '@/lib/candidates/service';
import { AppError } from '@/lib/errors';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {return api(request,async()=>{const {id}=await params;candidateIdSchema.parse(id);const c=(await getDashboard('live')).candidates.find(c=>c.id===id);if(!c) throw new AppError('NOT_FOUND','Candidate not found.',404);return c;});}
