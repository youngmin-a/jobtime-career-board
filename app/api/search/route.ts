import {allowMutation,failure} from '@/lib/http';
import {searchJobs} from '@/lib/search';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{allowMutation(request);const raw=await request.text();if(raw.length>5000)throw new Error('검색어가 너무 깁니다.');const body=JSON.parse(raw);if(typeof body.query!=='string'||!body.query.trim()||body.query.length>2000)throw new Error('기업명 또는 공고 키워드를 입력해주세요.');return Response.json(await searchJobs(body.query.trim()),{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}

