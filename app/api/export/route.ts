import {addWorkspaceHeaders,storeForRequest} from "@/lib/store";
import {SessionError} from '@/lib/names';
export const dynamic="force-dynamic";
export async function GET(request:Request){try{const {context,repository}=await storeForRequest(request);return addWorkspaceHeaders(new Response(JSON.stringify(await repository.read(),null,2),{headers:{"Content-Type":"application/json","Content-Disposition":'attachment; filename="jobtime-backup.json"'}}),context)}catch(e){return Response.json({error:e instanceof SessionError?e.message:"백업을 내보내지 못했습니다."},{status:e instanceof SessionError?401:500,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}})}}
