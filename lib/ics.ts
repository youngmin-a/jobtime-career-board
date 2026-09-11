import {addDays,eventDate,type Application,type CalendarEvent,type Point} from "./applications";

const escapeText=(value:string)=>value.replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
const compactDate=(value:string)=>value.replaceAll("-","");
const compactTime=(point:Point)=>compactDate(point.date)+"T"+(point.time??"00:00").replace(":","")+String(point.second??0).padStart(2,"0");
const stamp=()=>new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");

function fold(line:string){
  const encoder=new TextEncoder();let part="",bytes=0;const rows:string[]=[];
  for(const character of line){const size=encoder.encode(character).length;if(bytes+size>73&&part){rows.push(part);part=" "+character;bytes=1+size}else{part+=character;bytes+=size}}
  if(part)rows.push(part);return rows.join("\r\n");
}

export function createCalendarIcs(events:CalendarEvent[],applications:Application[],includeUrl=true){
  const apps=new Map(applications.map(application=>[application.id,application]));
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Job Calendar//Career Schedule//KO","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:취준캘린더","X-WR-TIMEZONE:Asia/Seoul"];
  for(const event of events){
    const application=apps.get(event.applicationId),start=event.schedule.start??event.schedule.end!;
    lines.push("BEGIN:VEVENT",`UID:${escapeText(event.applicationId+":"+event.sourceKey)}@jobtime-career-board`,"DTSTAMP:"+stamp());
    if(start.time){lines.push(`DTSTART;TZID=Asia/Seoul:${compactTime(start)}`);if(event.schedule.end?.time)lines.push(`DTEND;TZID=Asia/Seoul:${compactTime(event.schedule.end)}`)}
    else{lines.push(`DTSTART;VALUE=DATE:${compactDate(start.date)}`);lines.push(`DTEND;VALUE=DATE:${compactDate(addDays(event.schedule.end?.date??start.date,1))}`)}
    lines.push("SUMMARY:"+escapeText(`${event.companyName} · ${event.title}`));
    lines.push("DESCRIPTION:"+escapeText(`${event.postingTitle} · ${event.type==='preparation'?'개인 준비 항목':'취업 일정'}`));
    if(includeUrl&&application?.postingUrl)lines.push("URL:"+application.postingUrl);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");return lines.map(fold).join("\r\n")+"\r\n";
}

export function filterCalendarExport(events:CalendarEvent[],options:{from?:string;to?:string;applicationId?:string;includePersonal:boolean}){
  return events.filter(event=>(!options.applicationId||event.applicationId===options.applicationId)&&(!options.from||eventDate(event)>=options.from)&&(!options.to||eventDate(event)<=options.to)&&(options.includePersonal||!['personal','preparation'].includes(event.type)));
}
