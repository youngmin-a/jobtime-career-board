import {env} from 'cloudflare:workers';
import {allowMutation} from '@/lib/http';
import {createNameSession,endNameSession,getNameSession,importLegacy,legacyAvailable,nameCookie,requireSessionTag,SessionError} from '@/lib/names';
import {workspaceContext} from '@/lib/workspace';
import {repository,Conflict} from '@/lib/repository';
export const dynamic='force-dynamic';
const db=()=> (env as unknown as {DB:D1Database}).DB;
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
export async function GET(request:Request){try{
 const session=await getNameSession(db(),request),legacy=await workspaceContext(request);
 const count=legacy.setCookie?0:await legacyAvailable(db(),legacy.id);
 return response({session:session?{displayName:session.displayName,sessionTag:session.sessionTag}:null,legacyCount:count});
 }catch{return response({error:'접속 정보를 읽지 못했습니다. 잠시 후 다시 시도해주세요.'},503)}}
export async function POST(request:Request){try{
 allowMutation(request);const raw=await request.text();if(raw.length>2000)throw new Error('입력을 확인해주세요.');const body=JSON.parse(raw);
 const before=await getNameSession(db(),request);
 if(body.action==='enter'){
  if(before)requireSessionTag(request,before);
  const session=await createNameSession(db(),body.name);
  if(before)await endNameSession(db(),before);
  const r=response({session:{displayName:session.displayName,sessionTag:session.sessionTag}});r.headers.set('Set-Cookie',nameCookie(request,session.token));return r;
 }
 if(!before)throw new SessionError();requireSessionTag(request,before);
 if(body.action==='leave'){await endNameSession(db(),before);const r=response({session:null});r.headers.set('Set-Cookie',nameCookie(request,''));return r}
 if(body.action==='import-legacy'){
  if(!Number.isSafeInteger(body.revision))throw new Error('저장 버전을 확인해주세요.');
  const legacy=await workspaceContext(request);if(legacy.setCookie)throw new Error('이 브라우저에서 확인할 수 있는 기존 기록이 없습니다.');
  // A verified platform owner may materialize their preserved legacy state before importing.
  if(legacy.legacyOwner)await repository(db(),legacy.id,{legacyOwner:true}).read();
  return response(await importLegacy(db(),legacy.id,before.workspaceId,body.revision));
 }
 throw new Error('지원하지 않는 요청입니다.');
 }catch(e){return response({error:e instanceof SessionError||e instanceof Conflict?e.message:e instanceof Error&&!/D1_|SQLITE|constraint|database/i.test(e.message)?e.message:'요청을 저장하지 못했습니다. 기존 기록은 보존됩니다.'},e instanceof SessionError?401:e instanceof Conflict?409:400)}}
