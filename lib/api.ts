import 'server-only';
import { ZodError } from 'zod';
import { requireFounder, requireSameOrigin } from './auth';
import { AppError, errorResponse } from './errors';
export async function api(request:Request, action:()=>Promise<unknown>, options:{publicDemo?:boolean}={}) {
 try {
  const demo=options.publicDemo&&new URL(request.url).searchParams.get('mode')==='demo';
  if(!demo) await requireFounder();
  if(request.method!=='GET') requireSameOrigin(request);
  return Response.json(await action(),{headers:{'Cache-Control':'no-store'}});
 } catch(error) {
  if(error instanceof ZodError) return errorResponse(new AppError('INVALID_INPUT','Check the submitted fields and try again.'));
  return errorResponse(error);
 }
}
