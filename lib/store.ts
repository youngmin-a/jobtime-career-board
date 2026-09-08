import {env} from "cloudflare:workers";
import {repository} from "./repository";
import {workspaceContext,type WorkspaceContext} from "./workspace";

export async function storeForRequest(request:Request){
  const context=await workspaceContext(request);
  const db=(env as unknown as {DB:D1Database}).DB;
  return {context,repository:repository(db,context.id,{legacyOwner:context.legacyOwner})};
}

export function addWorkspaceHeaders(response:Response,context:WorkspaceContext){
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("Vary","Cookie");
  if(context.setCookie)response.headers.set("Set-Cookie",context.setCookie);
  return response;
}
