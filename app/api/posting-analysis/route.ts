import {env} from "cloudflare:workers";
import {allowMutation} from "@/lib/http";
import {analyzePosting,type PostingAnalysis} from "@/lib/posting-analysis";
import {normalizedPostingUrl} from "@/lib/posting-identity";
import {addWorkspaceHeaders,storeForRequest} from "@/lib/store";
import {SessionError} from "@/lib/names";

export const dynamic="force-dynamic";
const cache=new Map<string,{expires:number;value:PostingAnalysis}>(),inflight=new Map<string,Promise<PostingAnalysis>>();
class RateLimitError extends Error{}

async function take(db:D1Database,workspaceId:string){const now=Date.now(),windowStart=Math.floor(now/600000)*600000,row=await db.prepare("INSERT INTO analysis_usage (workspace_id,window_start,count) VALUES (?,?,1) ON CONFLICT(workspace_id,window_start) DO UPDATE SET count=count+1 RETURNING count").bind(workspaceId,windowStart).first<{count:number}>();if(!row||row.count>12)throw new RateLimitError("10분 동안 공고 분석은 12회까지 가능합니다. 잠시 후 다시 시도해주세요.");if(row.count===1)await db.prepare("DELETE FROM analysis_usage WHERE window_start<?").bind(windowStart-86400000).run()}
async function limitedText(request:Request,maxBytes:number){if(Number(request.headers.get("content-length")??0)>maxBytes)throw new Error("분석할 본문이 너무 깁니다.");if(!request.body)return "";const reader=request.body.getReader(),decoder=new TextDecoder();let size=0,result="";for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error("분석할 본문이 너무 깁니다.")}result+=decoder.decode(value,{stream:true})}return result+decoder.decode()}

export async function GET(request:Request){try{const {context}=await storeForRequest(request),runtime=env as unknown as {OPENAI_API_KEY?:string;TAVILY_API_KEY?:string};return addWorkspaceHeaders(Response.json({aiAvailable:!!runtime.OPENAI_API_KEY?.trim(),extractorAvailable:!!runtime.TAVILY_API_KEY?.trim()}),context)}catch(error){return Response.json({error:error instanceof SessionError?error.message:"분석 설정을 확인하지 못했습니다."},{status:error instanceof SessionError?401:400,headers:{"Cache-Control":"private, no-store",Vary:"Cookie"}})}}

export async function POST(request:Request){
  try{
    allowMutation(request);const {context,db}=await storeForRequest(request),raw=await limitedText(request,85000);
    const input=JSON.parse(raw) as {url?:unknown;pastedText?:unknown};if(typeof input.url!=="string"||input.url.length>2000)throw new Error("공고 URL을 확인해주세요.");if(input.pastedText!==undefined&&typeof input.pastedText!=="string")throw new Error("붙여넣은 본문을 확인해주세요.");await take(db,context.id);
    const runtime=env as unknown as {OPENAI_API_KEY?:string;OPENAI_MODEL?:string;TAVILY_API_KEY?:string},pastedText=typeof input.pastedText==="string"?input.pastedText.trim():"",key=normalizedPostingUrl(input.url),now=Date.now();
    const cached=!pastedText?cache.get(key):undefined;
    let result:PostingAnalysis;if(cached&&cached.expires>now)result=cached.value;else{
      let task=!pastedText?inflight.get(key):undefined;if(!task){task=analyzePosting({url:input.url,pastedText:pastedText||undefined},{openAiApiKey:runtime.OPENAI_API_KEY?.trim()||undefined,openAiModel:runtime.OPENAI_MODEL?.trim()||undefined,tavilyApiKey:runtime.TAVILY_API_KEY?.trim()||undefined});if(!pastedText)inflight.set(key,task)}
      try{result=await task}finally{if(!pastedText)inflight.delete(key)}if(!pastedText){if(cache.size>=50)cache.delete(cache.keys().next().value!);cache.set(key,{expires:now+600000,value:result})}
    }
    return addWorkspaceHeaders(Response.json(result),context);
  }catch(error){const message=error instanceof Error?error.message:"공고를 분석하지 못했습니다.";return Response.json({error:/OPENAI_API_KEY|TAVILY_API_KEY/i.test(message)?"공고 분석 서비스 설정을 확인해주세요.":message},{status:error instanceof SessionError?401:error instanceof RateLimitError?429:400,headers:{"Cache-Control":"private, no-store",Vary:"Cookie"}})}
}
