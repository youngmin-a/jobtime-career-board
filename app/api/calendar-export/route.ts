import {calendarEvents} from "@/lib/applications";
import {filterCalendarExport,createCalendarIcs} from "@/lib/ics";
import {validPoint} from "@/lib/jobs";
import {addWorkspaceHeaders,storeForRequest} from "@/lib/store";
import {SessionError} from "@/lib/names";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  try{
    const {context,repository}=await storeForRequest(request),state=await repository.read(),url=new URL(request.url);
    const from=url.searchParams.get("from")??undefined,to=url.searchParams.get("to")??undefined,applicationId=url.searchParams.get("applicationId")??undefined,company=url.searchParams.get("company")??undefined;
    if(from&&!validPoint({date:from,time:null})||to&&!validPoint({date:to,time:null})||from&&to&&from>to)throw new Error("내보낼 날짜 범위를 확인해주세요.");
    if(from&&to&&(Date.parse(to)-Date.parse(from))/86400000>370)throw new Error("한 번에 1년 이내 일정만 내보낼 수 있습니다.");
    if(applicationId&&!state.applications.some(application=>application.id===applicationId))return addWorkspaceHeaders(Response.json({error:"공고를 찾지 못했습니다."},{status:404}),context);
    const includePersonal=url.searchParams.get("includePersonal")==="true",includeUrl=url.searchParams.get("includeUrl")!=="false";
    if(company&&company.length>100)throw new Error("기업 필터를 확인해주세요.");
    const events=filterCalendarExport(calendarEvents(state.applications),{from,to,applicationId,includePersonal}).filter(event=>!company||event.companyName===company);
    const response=new Response(createCalendarIcs(events,state.applications,includeUrl),{headers:{"Content-Type":"text/calendar; charset=utf-8","Content-Disposition":'attachment; filename="career-calendar.ics"',"X-Content-Type-Options":"nosniff"}});
    return addWorkspaceHeaders(response,context);
  }catch(error){return Response.json({error:error instanceof SessionError?error.message:error instanceof Error?error.message:"일정을 내보내지 못했습니다."},{status:error instanceof SessionError?401:400,headers:{"Cache-Control":"private, no-store",Vary:"Cookie"}})}
}
