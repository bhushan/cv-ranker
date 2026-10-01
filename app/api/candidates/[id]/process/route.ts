import { api } from '@/lib/api';
import { processCandidate,stageSchema } from '@/lib/candidates/service';
import { z } from 'zod';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {return api(request,async()=>{const {id}=await params;const {stage}=z.object({stage:stageSchema}).strict().parse(await request.json());return processCandidate(id,stage);});}
