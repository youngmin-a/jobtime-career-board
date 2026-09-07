export function isOwner(userId:string|null,ownerId:string|undefined){return !!userId&&!!ownerId&&userId===ownerId}
