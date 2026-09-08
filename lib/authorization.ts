import {workspaceContext} from "./workspace";

export async function viewer(request:Request){
  const context=await workspaceContext(request);
  return {
    canEdit:true,
    workspaceKind:context.kind,
    hasPlatformIdentity:context.kind==="account",
  };
}
