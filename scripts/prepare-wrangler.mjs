import {readFile, writeFile} from "node:fs/promises";

const rawDatabaseId=(process.env.CLOUDFLARE_D1_DATABASE_ID||"").trim();
if(!rawDatabaseId) throw new Error("CLOUDFLARE_D1_DATABASE_ID is required");

const compactDatabaseId=rawDatabaseId.replaceAll("-","");
const databaseId=/^[0-9a-f]{32}$/i.test(compactDatabaseId)
  ? `${compactDatabaseId.slice(0,8)}-${compactDatabaseId.slice(8,12)}-${compactDatabaseId.slice(12,16)}-${compactDatabaseId.slice(16,20)}-${compactDatabaseId.slice(20)}`
  : rawDatabaseId;
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId)) {
  throw new Error("CLOUDFLARE_D1_DATABASE_ID must be a Cloudflare D1 UUID");
}
const path="dist/server/wrangler.json";
const config=JSON.parse(await readFile(path,"utf8"));
config.name=process.env.CLOUDFLARE_WORKER_NAME||"jobtime-career-board";
if(process.env.CLOUDFLARE_ACCOUNT_ID) config.account_id=process.env.CLOUDFLARE_ACCOUNT_ID;
config.d1_databases=[{
  binding:"DB",
  database_name:"jobtime-d1",
  database_id:databaseId,
  migrations_dir:"../../migrations",
}];
config.vars={...(config.vars||{}),JOBTIME_PUBLIC_DEMO:"true"};
await writeFile(path,JSON.stringify(config,null,2)+"\n");
