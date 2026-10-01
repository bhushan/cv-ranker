import { api } from '@/lib/api';
import { getDashboard, uploadCandidate } from '@/lib/candidates/service';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request) {return api(request,()=>getDashboard(new URL(request.url).searchParams.get('mode')==='demo'?'demo':'live'),{publicDemo:true});}
export async function POST(request:Request) {return api(request,async()=>uploadCandidate(await request.formData()));}
