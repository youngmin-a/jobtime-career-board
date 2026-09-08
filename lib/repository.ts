import {migrateV1,validateState,type State} from "./applications";

export class Conflict extends Error {
  constructor(){super("다른 화면에서 변경되었습니다. 입력을 보존했으니 최신 데이터를 다시 불러온 후 저장해주세요.")}
}

type Options = {legacyOwner?: boolean};

// Kept for the domain test harness and one-time local inspection of the pre-v2 tables.
function legacyRepository(db:D1Database){
  async function backup(id:string):Promise<State>{
    const row=await db.prepare("SELECT payload FROM job_backups WHERE id=?").bind(id).first<{payload:string}>();
    if(!row)throw new Error("백업을 찾지 못했습니다.");
    const raw=JSON.parse(row.payload),state=raw.version===1?migrateV1(raw):raw;validateState(state);return state;
  }
  async function read():Promise<State>{
    const row=await db.prepare("SELECT payload, revision FROM job_state_v2 WHERE id=1").first<{payload:string;revision:number}>();
    if(row){const state=JSON.parse(row.payload) as State;state.revision=row.revision;validateState(state);return state;}
    const old=await db.prepare("SELECT payload FROM app_state WHERE id=1").first<{payload:string}>();
    const state:State=old?migrateV1(JSON.parse(old.payload)):{version:2,revision:0,applications:[]};
    const statements:D1PreparedStatement[]=old?[db.prepare("INSERT OR IGNORE INTO job_backups (id,payload,reason,created_at) VALUES (?,?,?,?)").bind("legacy-v1",old.payload,"v1 migration",new Date().toISOString())]:[];
    statements.push(db.prepare("INSERT OR IGNORE INTO job_state_v2 (id,payload,revision) VALUES (1,?,0)").bind(JSON.stringify(state)));
    await db.batch(statements);
    const saved=await db.prepare("SELECT payload,revision FROM job_state_v2 WHERE id=1").first<{payload:string;revision:number}>();
    if(!saved)throw new Error("저장소 초기화 실패");const next=JSON.parse(saved.payload) as State;next.revision=saved.revision;validateState(next);return next;
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
  return {read,update,backup};
}

export function repository(db:D1Database,workspaceId?:string,options:Options={}){
  if(!workspaceId)return legacyRepository(db);
  if(!/^([a-z]+_[a-z0-9_-]{20,80})$/i.test(workspaceId))throw new Error("작업공간을 확인해주세요.");

  async function backup(id:string):Promise<State>{
    const row=await db.prepare("SELECT payload FROM workspace_backups WHERE id=? AND workspace_id=?").bind(id,workspaceId).first<{payload:string}>();
    if(!row)throw new Error("백업을 찾지 못했습니다.");
    const raw=JSON.parse(row.payload),state=raw.version===1?migrateV1(raw):raw;validateState(state);return state;
  }

  async function legacyState():Promise<{state:State;raw:string|null}>{
    if(!options.legacyOwner)return {state:{version:2,revision:0,applications:[]},raw:null};
    const v2=await db.prepare("SELECT payload,revision FROM job_state_v2 WHERE id=1").first<{payload:string;revision:number}>();
    if(v2){const state=JSON.parse(v2.payload) as State;state.revision=v2.revision;validateState(state);return {state,raw:v2.payload};}
    const old=await db.prepare("SELECT payload FROM app_state WHERE id=1").first<{payload:string}>();
    if(old){const state=migrateV1(JSON.parse(old.payload));return {state,raw:old.payload};}
    return {state:{version:2,revision:0,applications:[]},raw:null};
  }

  async function read():Promise<State>{
    const row=await db.prepare("SELECT payload,revision FROM workspace_state WHERE workspace_id=?").bind(workspaceId).first<{payload:string;revision:number}>();
    if(row){const state=JSON.parse(row.payload) as State;state.revision=row.revision;validateState(state);return state;}
    const legacy=await legacyState(),now=new Date().toISOString();
    const statements=[] as D1PreparedStatement[];
    if(legacy.raw){
      statements.push(db.prepare("INSERT OR IGNORE INTO workspace_backups (id,workspace_id,payload,reason,created_at,revision) VALUES (?,?,?,?,?,?)").bind(`legacy-${workspaceId}`,workspaceId,legacy.raw,"legacy import",now,legacy.state.revision));
    }
    statements.push(db.prepare("INSERT OR IGNORE INTO workspace_state (workspace_id,payload,revision,updated_at) VALUES (?,?,?,?)").bind(workspaceId,JSON.stringify(legacy.state),legacy.state.revision,now));
    await db.batch(statements);
    const saved=await db.prepare("SELECT payload,revision FROM workspace_state WHERE workspace_id=?").bind(workspaceId).first<{payload:string;revision:number}>();
    if(!saved)throw new Error("저장소 초기화 실패");
    const state=JSON.parse(saved.payload) as State;state.revision=saved.revision;validateState(state);return state;
  }

  async function update(revision:number,change:(state:State)=>State):Promise<State>{
    const before=await read();
    if(before.revision!==revision)throw new Conflict();
    const after=change(structuredClone(before));after.revision=revision+1;validateState(after);
    const results=await db.batch([
      db.prepare("INSERT INTO workspace_backups (id,workspace_id,payload,reason,created_at,revision) SELECT ?,workspace_id,payload,?,?,revision FROM workspace_state WHERE workspace_id=? AND revision=?").bind(crypto.randomUUID(),"before update",new Date().toISOString(),workspaceId,revision),
      db.prepare("UPDATE workspace_state SET payload=?,revision=?,updated_at=? WHERE workspace_id=? AND revision=?").bind(JSON.stringify(after),after.revision,new Date().toISOString(),workspaceId,revision)
    ]);
    if(results[1].meta.changes!==1)throw new Conflict();
    return after;
  }
  return {read,update,backup};
}
