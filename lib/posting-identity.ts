export function normalizedPostingUrl(value:string|null){if(!value)return '';try{const u=new URL(value);u.hash='';for(const key of u.searchParams.keys())if(/^utm_|^(source|ref)$/i.test(key))u.searchParams.delete(key);u.searchParams.sort();return u.href.replace(/\/$/,'')}catch{return value}}
type Identity={provider:string|null;officialPostingId:string|null;postingUrl:string|null;companyName:string;postingTitle:string};
export function samePosting(a:Identity,b:Identity){
 if(a.provider&&a.provider===b.provider&&a.officialPostingId&&a.officialPostingId===b.officialPostingId)return true;
 if(a.postingUrl&&b.postingUrl&&normalizedPostingUrl(a.postingUrl)===normalizedPostingUrl(b.postingUrl))return true;
 const norm=(s:string)=>s.normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
 return norm(a.companyName)===norm(b.companyName)&&norm(a.postingTitle)===norm(b.postingTitle);
}
