import {env} from 'cloudflare:workers';
import {isOwner} from './access';
export function viewer(request:Request){const userId=request.headers.get('oai-authenticated-user-id');const owner=(env as unknown as {JOBTIME_OWNER_ID?:string}).JOBTIME_OWNER_ID;return{userId,canEdit:(import.meta as {env?:{DEV?:boolean}}).env?.DEV===true||isOwner(userId,owner)}}
