export function normalizedPostingUrl(value:string|null){if(!value)return '';try{const u=new URL(value);u.hash='';for(const key of u.searchParams.keys())if(/^utm_|^(source|ref)$/i.test(key))u.searchParams.delete(key);u.searchParams.sort();return u.href.replace(/\/$/,'')}catch{return value}}
type Identity={provider:string|null;officialPostingId:string|null;postingUrl:string|null;companyName:string;postingTitle:string;role?:string;recruitment?:{start?:{date:string}|null;end?:{date:string}|null}};
export function samePosting(a:Identity,b:Identity){
 if(a.provider&&a.provider===b.provider&&a.officialPostingId&&a.officialPostingId===b.officialPostingId)return true;
 if(a.postingUrl&&b.postingUrl&&normalizedPostingUrl(a.postingUrl)===normalizedPostingUrl(b.postingUrl))return true;
 const norm=(s:string)=>s.normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
 if(norm(a.companyName)!==norm(b.companyName)||norm(a.postingTitle)!==norm(b.postingTitle))return false;
 if(a.role&&b.role&&norm(a.role)!==norm(b.role))return false;
 const aStart=a.recruitment?.start?.date??null,bStart=b.recruitment?.start?.date??null,aEnd=a.recruitment?.end?.date??null,bEnd=b.recruitment?.end?.date??null;
 // 동일 제목이라도 접수 회차의 날짜가 다르면 서로 다른 공고로 보존한다.
 if(aStart!==bStart||aEnd!==bEnd)return false;
 return true;
}
