import {Conflict,repository} from './repository';
import {validateState,type State} from './applications';

export const NAME_COOKIE='jobtime_name_session';
export const SESSION_SECONDS=60*60*24*180;
export type NameSession={workspaceId:string;displayName:string;sessionTag:string;tokenHash:string};
export class SessionError extends Error {constructor(){super('이름을 입력해 캘린더를 다시 열어주세요.')}}
function hasUnsafeNameCharacter(value:string){for(const char of value){const code=char.codePointAt(0)!;if(code<32||code===127||(code>=0x200b&&code<=0x200f)||(code>=0x202a&&code<=0x202e)||(code>=0x2066&&code<=0x2069))return true}return false}
export function normalizeName(value:unknown){
 if(typeof value!=='string')throw new Error('이름 또는 별명을 입력해주세요.');
 const displayName=value.normalize('NFC').trim().replace(/\s+/gu,' ');
 if(!displayName||[...displayName].length>40||hasUnsafeNameCharacter(displayName))throw new Error('이름 또는 별명을 1~40자로 입력해주세요.');
 return {displayName,key:displayName.replace(/[A-Z]/g,c=>c.toLowerCase())};
}
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('')}
export function readCookie(request:Request,name:string){return (request.headers.get('cookie')??'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)??null}
export function nameCookie(request:Request,token:string){return `${NAME_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?SESSION_SECONDS:0}${new URL(request.url).protocol==='https:'?'; Secure':''}`}
export async function openName(db:D1Database,value:unknown){
 const name=normalizeName(value);
 await db.prepare('INSERT OR IGNORE INTO named_spaces (workspace_id,name_key,display_name,created_at) VALUES (?,?,?,?)').bind('named_'+crypto.randomUUID(),name.key,name.displayName,new Date().toISOString()).run();
 const row=await db.prepare('SELECT workspace_id,display_name FROM named_spaces WHERE name_key=?').bind(name.key).first<{workspace_id:string;display_name:string}>();
 if(!row)throw new Error('개인 공간을 열지 못했습니다. 다시 시도해주세요.');
 return {workspaceId:row.workspace_id,displayName:row.display_name};
}
export async function createNameSession(db:D1Database,value:unknown){
 const space=await openName(db,value),token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join(''),tokenHash=await digest(token),sessionTag=crypto.randomUUID();
 await db.prepare('INSERT INTO name_sessions (token_hash,workspace_id,session_tag,expires_at) VALUES (?,?,?,?)').bind(tokenHash,space.workspaceId,sessionTag,Date.now()+SESSION_SECONDS*1000).run();
 return {...space,token,tokenHash,sessionTag};
}
export async function getNameSession(db:D1Database,request:Request):Promise<NameSession|null>{
 const token=readCookie(request,NAME_COOKIE);if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const tokenHash=await digest(token),row=await db.prepare('SELECT s.workspace_id,s.session_tag,n.display_name FROM name_sessions s JOIN named_spaces n ON n.workspace_id=s.workspace_id WHERE s.token_hash=? AND s.expires_at>?').bind(tokenHash,Date.now()).first<{workspace_id:string;session_tag:string;display_name:string}>();
 return row?{workspaceId:row.workspace_id,sessionTag:row.session_tag,displayName:row.display_name,tokenHash}:null;
}
export function requireSessionTag(request:Request,session:NameSession){if(request.headers.get('X-Workspace-Session')!==session.sessionTag)throw new SessionError()}
export async function endNameSession(db:D1Database,session:NameSession){await db.prepare('DELETE FROM name_sessions WHERE token_hash=?').bind(session.tokenHash).run()}
export function mergeLegacy(target:State,source:State):State{
 const after=structuredClone(target);
 for(const app of source.applications){const existing=after.applications.find(a=>a.id===app.id);if(existing){if(JSON.stringify(existing)!==JSON.stringify(app))throw new Error('같은 공고 ID에 서로 다른 기록이 있어 가져오기를 중단했습니다. 양쪽 백업을 보존하고 공고별로 확인해주세요.');continue}after.applications.push(structuredClone(app))}
 validateState(after);return after;
}
export async function legacyAvailable(db:D1Database,sourceId:string){
 const receipt=await db.prepare('SELECT source_workspace_id FROM name_imports WHERE source_workspace_id=?').bind(sourceId).first();if(receipt)return 0;
 const row=await db.prepare('SELECT payload,revision FROM workspace_state WHERE workspace_id=?').bind(sourceId).first<{payload:string;revision:number}>();if(!row)return 0;
 const state=JSON.parse(row.payload) as State;state.revision=row.revision;validateState(state);return state.applications.length;
}
export async function importLegacy(db:D1Database,sourceId:string,targetId:string,revision:number){
 const receipt=await db.prepare('SELECT target_workspace_id FROM name_imports WHERE source_workspace_id=?').bind(sourceId).first<{target_workspace_id:string}>();
 if(receipt){if(receipt.target_workspace_id!==targetId)throw new Error('이 브라우저의 기존 기록은 이미 다른 이름 공간으로 가져왔습니다. 원본은 보존되어 있습니다.');return repository(db,targetId).read()}
 const source=await db.prepare('SELECT payload,revision FROM workspace_state WHERE workspace_id=?').bind(sourceId).first<{payload:string;revision:number}>();if(!source)throw new Error('가져올 기존 기록이 없습니다.');
 const original=JSON.parse(source.payload) as State;original.revision=source.revision;validateState(original);
 const target=await repository(db,targetId).read();if(target.revision!==revision)throw new Conflict();
 const after=mergeLegacy(target,original);after.revision=revision+1;const now=new Date().toISOString(),operation=crypto.randomUUID();
 const result=await db.batch([
  db.prepare('INSERT INTO name_imports (source_workspace_id,target_workspace_id,import_id,created_at) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM workspace_state WHERE workspace_id=? AND revision=?) AND EXISTS (SELECT 1 FROM workspace_state WHERE workspace_id=? AND revision=?)').bind(sourceId,targetId,operation,now,targetId,revision,sourceId,source.revision),
  db.prepare('INSERT INTO workspace_backups (id,workspace_id,payload,reason,created_at,revision) SELECT ?,workspace_id,payload,?,?,revision FROM workspace_state WHERE workspace_id=? AND EXISTS (SELECT 1 FROM name_imports WHERE import_id=?)').bind(crypto.randomUUID(),'before name import: source',now,sourceId,operation),
  db.prepare('INSERT INTO workspace_backups (id,workspace_id,payload,reason,created_at,revision) SELECT ?,workspace_id,payload,?,?,revision FROM workspace_state WHERE workspace_id=? AND EXISTS (SELECT 1 FROM name_imports WHERE import_id=?)').bind(crypto.randomUUID(),'before name import: target',now,targetId,operation),
  db.prepare('UPDATE workspace_state SET payload=?,revision=?,updated_at=? WHERE workspace_id=? AND revision=? AND EXISTS (SELECT 1 FROM name_imports WHERE import_id=?)').bind(JSON.stringify(after),after.revision,now,targetId,revision,operation)
 ]);
 if(result[3].meta.changes!==1)throw new Conflict();return after;
}
