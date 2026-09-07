import {viewer} from '@/lib/authorization';
export const dynamic='force-dynamic';
export async function GET(request:Request){return Response.json(viewer(request),{headers:{'Cache-Control':'no-store'}})}
