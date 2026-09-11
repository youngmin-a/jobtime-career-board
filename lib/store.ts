import {env} from "cloudflare:workers";
import {repository} from "./repository";
import {type WorkspaceContext} from "./workspace";
import {getNameSession,requireSessionTag,SessionError} from './names';

export async function storeForRequest(request:Request){
  const db=(env as unknown as {DB:D1Database}).DB;
  const session=await getNameSession(db,request);
  if(!session)throw new SessionError();
  if(request.method!=='GET'||request.headers.has('X-Workspace-Session'))requireSessionTag(request,session);
  const context:WorkspaceContext={id:session.workspaceId,kind:'named',legacyOwner:false};
  return {context,repository:repository(db,context.id,{legacyOwner:context.legacyOwner}),db};
}

export function addWorkspaceHeaders(response:Response,context:WorkspaceContext){
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("Vary","Cookie");
  if(context.setCookie)response.headers.set("Set-Cookie",context.setCookie);
  return response;
}
