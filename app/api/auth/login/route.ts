import { authClient,requireSameOrigin } from '@/lib/auth';
import { AppError,errorResponse } from '@/lib/errors';
import { z } from 'zod';
export async function POST(request:Request) {
 try {requireSameOrigin(request);const {email,password}=z.object({email:z.email(),password:z.string().min(1).max(200)}).parse(await request.json());const client=await authClient();const {data,error}=await client.auth.signInWithPassword({email,password});if(error||data.user?.id!==process.env.FOUNDER_USER_ID){await client.auth.signOut();throw new AppError('UNAUTHORIZED','Sign in with the configured founder account.',401);}return Response.json({ok:true});}catch(error){return errorResponse(error);}
}
