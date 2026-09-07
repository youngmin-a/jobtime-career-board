import {migrateV1,validateState,type State} from "./applications";
export class Conflict extends Error {constructor(){super("다른 화면에서 변경되었습니다. 입력을 보존했으니 최신 데이터를 다시 불러온 후 저장해주세요.")}}
export function repository(db:D1Database){
 async function backup(id:string):Promise<State>{
  const row=await db.prepare("SELECT payload FROM job_backups WHERE id=?").bind(id).first<{payload:string}>();
  if(!row)throw new Error("백업을 찾지 못했습니다.");
  const raw=JSON.parse(row.payload),state=raw.version===1?migrateV1(raw):raw;validateState(state);return state;
 }
 async function read():Promise<State>{
  const row=await db.prepare("SELECT payload, revision FROM job_state_v2 WHERE id=1").first<{payload:string;revision:number}>();
  if(row){const s=JSON.parse(row.payload);s.revision=row.revision;validateState(s);return s}
  const old=await db.prepare("SELECT payload FROM app_state WHERE id=1").first<{payload:string}>();
  const state:State=old?migrateV1(JSON.parse(old.payload)):{version:2,revision:0,applications:[]};
  // Legacy table is never modified. Backup and v2 insertion commit together.
  const sql=old?[db.prepare("INSERT OR IGNORE INTO job_backups (id,payload,reason,created_at) VALUES (?,?,?,?)").bind("legacy-v1",old.payload,"v1 migration",new Date().toISOString())]:[];
  sql.push(db.prepare("INSERT OR IGNORE INTO job_state_v2 (id,payload,revision) VALUES (1,?,0)").bind(JSON.stringify(state)));
  await db.batch(sql);
  const saved=await db.prepare("SELECT payload,revision FROM job_state_v2 WHERE id=1").first<{payload:string;revision:number}>();
  if(!saved)throw new Error("저장소 초기화 실패");const s=JSON.parse(saved.payload);s.revision=saved.revision;validateState(s);return s;
 }
 async function update(revision:number,change:(state:State)=>State):Promise<State>{
  const before=await read();if(before.revision!==revision)throw new Conflict();
  const after=change(structuredClone(before));after.revision=revision+1;validateState(after);
  const results=await db.batch([
   db.prepare("INSERT INTO job_backups (id,payload,reason,created_at) SELECT ?,payload,?,? FROM job_state_v2 WHERE id=1 AND revision=?").bind(crypto.randomUUID(),"before update",new Date().toISOString(),revision),
   db.prepare("UPDATE job_state_v2 SET payload=?,revision=? WHERE id=1 AND revision=?").bind(JSON.stringify(after),after.revision,revision)
  ]);
  if(results[1].meta.changes!==1)throw new Conflict();return after;
 }
 return{read,update,backup};
}
