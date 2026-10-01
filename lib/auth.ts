import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { AppError } from './errors';
export function isConfigured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.FOUNDER_USER_ID); }
export async function authClient() {
  if (!isConfigured()) throw new AppError('SETUP_REQUIRED','The live workspace needs Supabase configuration and a founder account.',503);
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>store.getAll(),setAll:(values)=>{try {values.forEach(({name,value,options})=>store.set(name,value,{...options,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax'}));} catch { /* Server render cannot write cookies; API calls refresh the session. */ }}}});
}
export async function requireFounder() {
  const client = await authClient();
  const {data,error}=await client.auth.getUser();
  if(error || !data.user || data.user.id!==process.env.FOUNDER_USER_ID) throw new AppError('UNAUTHORIZED','Sign in with the founder account to access the live workspace.',401);
  return data.user;
}
export function requireSameOrigin(request: Request) {
  const origin=request.headers.get('origin');
  if (!origin || origin!==new URL(request.url).origin) throw new AppError('FORBIDDEN','This action must originate from this dashboard.',403);
}
