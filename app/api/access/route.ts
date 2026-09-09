import {env} from 'cloudflare:workers';
import {getNameSession} from '@/lib/names';
export const dynamic='force-dynamic';
export async function GET(request:Request){const session=await getNameSession((env as unknown as {DB:D1Database}).DB,request);return Response.json({canEdit:!!session,workspaceKind:session?'named':null},{headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}})}
