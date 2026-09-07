import {env} from "cloudflare:workers";
import {repository} from "./repository";
export const readStore=()=>repository((env as unknown as {DB:D1Database}).DB).read();
export const readBackup=(id:string)=>repository((env as unknown as {DB:D1Database}).DB).backup(id);
export const updateStore:ReturnType<typeof repository>["update"]=(revision,change)=>repository((env as unknown as {DB:D1Database}).DB).update(revision,change);
