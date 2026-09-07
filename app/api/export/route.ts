import {readStore} from "@/lib/store";
export const dynamic="force-dynamic";
export async function GET(){try{return new Response(JSON.stringify(await readStore(),null,2),{headers:{"Content-Type":"application/json","Content-Disposition":'attachment; filename="jobtime-backup.json"',"Cache-Control":"no-store"}})}catch{return Response.json({error:"백업을 내보내지 못했습니다."},{status:500})}}
