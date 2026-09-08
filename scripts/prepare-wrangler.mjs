import {readFile, writeFile} from "node:fs/promises";

const databaseId=process.env.CLOUDFLARE_D1_DATABASE_ID;
if(!databaseId) throw new Error("CLOUDFLARE_D1_DATABASE_ID is required");
const path="dist/server/wrangler.json";
const config=JSON.parse(await readFile(path,"utf8"));
config.name=process.env.CLOUDFLARE_WORKER_NAME||"jobtime-career-board";
if(process.env.CLOUDFLARE_ACCOUNT_ID) config.account_id=process.env.CLOUDFLARE_ACCOUNT_ID;
config.d1_databases=[{binding:"DB",database_name:"jobtime-d1",database_id:databaseId}];
config.vars={...(config.vars||{}),JOBTIME_PUBLIC_DEMO:"true"};
await writeFile(path,JSON.stringify(config,null,2)+"\n");
