import 'server-only';
import { z } from 'zod';
import { AppError } from '../errors';
import { getSupabaseAdmin } from '../supabase/client';
import { deliverEmail } from '../resend/client';
import { assertCanSend } from './drafts';
export const emailEditSchema=z.object({expected_updated_at:z.string().datetime({offset:true}),subject:z.string().trim().min(1).max(200).optional(),body:z.string().trim().min(1).max(10000).optional(),status:z.literal('REJECTED').optional()}).strict();
export async function editEmail(id:string,input:unknown) {
 const {expected_updated_at,...changes}=emailEditSchema.parse(input);
 const db=getSupabaseAdmin();
 const {data,error}=await db.from('email_drafts').update({...changes,updated_at:new Date().toISOString()}).eq('id',id).eq('status','PENDING_REVIEW').eq('updated_at',expected_updated_at).select().single();
 if(error || !data) throw new AppError('EMAIL_REVISION_CHANGED','This draft changed. Refresh and review the latest version.',409);
 return data;
}
export async function sendEmail(id:string, approved:boolean, expectedUpdatedAt:string) {
 assertCanSend('PENDING_REVIEW',approved);
 // Configuration must be checked before atomically consuming a send reservation.
 if(!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) throw new AppError('RESEND_NOT_CONFIGURED','Email delivery is not configured.',503);
 const db=getSupabaseAdmin();
 const {data:draft,error}=await db.rpc('claim_email_send',{draft_id:id,expected_updated_at:expectedUpdatedAt});
 if(error || !draft) { const code=error?.message.includes('QUOTA')?'RESEND_QUOTA_EXCEEDED':error?.message.includes('REVISION')?'EMAIL_REVISION_CHANGED':'EMAIL_ALREADY_SENT'; throw new AppError(code,code==='EMAIL_REVISION_CHANGED'?'This draft changed. Refresh and review it before approving.':code==='RESEND_QUOTA_EXCEEDED'?'The free email allowance is exhausted. Please try again later.':'This email has already been sent or is being sent.',409); }
 const {data:identity,error:identityError}=await db.from('candidate_identity').select('email').eq('candidate_id',draft.candidate_id).single();
 try {
  if(identityError || !identity?.email) throw new AppError('EMAIL_RECIPIENT_MISSING','The candidate email address is unavailable.');
  if(/@(?:example\.(?:com|org|net)|.+\.invalid)$/i.test(identity.email)) throw new AppError('EMAIL_RECIPIENT_INVALID','Synthetic demo addresses cannot receive real email. Use an authorized test candidate in the live workspace.');
  const resendId=await deliverEmail({id,to:identity.email,subject:draft.subject,body:draft.body});
  const {error:saveError}=await db.from('email_drafts').update({status:'SENT',sent_at:new Date().toISOString(),updated_at:new Date().toISOString(),resend_id:resendId,error:null}).eq('id',id).eq('status','SENDING');
  if(saveError) throw new AppError('EMAIL_STATUS_SAVE_FAILED','Delivery was accepted, but its status could not be saved. Do not resend; reconcile the provider record.',503);
  return {status:'SENT',resend_id:resendId};
 } catch(error) {
  // Keep SENDING even after network errors: provider acceptance may be ambiguous.
  const code=error instanceof AppError ? error.code : 'RESEND_FAILED';
  await db.from('email_drafts').update({error:code,updated_at:new Date().toISOString()}).eq('id',id).eq('status','SENDING');
  throw error instanceof AppError ? error : new AppError('RESEND_FAILED','Email delivery could not be confirmed. This send is locked; check Resend before taking further action.',503);
 }
}
