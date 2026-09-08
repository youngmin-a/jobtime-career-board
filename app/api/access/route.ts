import {addWorkspaceHeaders} from '@/lib/store';
import {workspaceContext} from '@/lib/workspace';
export const dynamic='force-dynamic';
export async function GET(request:Request){const context=await workspaceContext(request);return addWorkspaceHeaders(Response.json({canEdit:true,workspaceKind:context.kind,hasPlatformIdentity:context.kind==='account'}),context)}
