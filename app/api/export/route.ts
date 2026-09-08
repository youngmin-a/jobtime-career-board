import {addWorkspaceHeaders,storeForRequest} from "@/lib/store";
export const dynamic="force-dynamic";
export async function GET(request:Request){const {context,repository}=await storeForRequest(request);try{return addWorkspaceHeaders(new Response(JSON.stringify(await repository.read(),null,2),{headers:{"Content-Type":"application/json","Content-Disposition":'attachment; filename="jobtime-backup.json"'}}),context)}catch{return addWorkspaceHeaders(Response.json({error:"백업을 내보내지 못했습니다."},{status:500}),context)}}
