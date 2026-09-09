import {newStage,type Application} from './applications';
export const standardStages=['서류 제출','AI 역량검사','필기 전형','1차 면접','2차 면접','최종면접'];
export type Column={id:string;name:string;kind:'preparing'|'stage'|'accepted'|'archived';stageKey?:string};
export function stageKey(name:string){
 const value=name.toLowerCase().replace(/[\s·・_-]/g,'');
 if(/최종합격|최종합격자/.test(value))return'final-accepted';
 if(/최종면접/.test(value))return'interview-final';
 if(/2차.*면접/.test(value))return'interview-2';
 if(/1차.*면접/.test(value))return'interview-1';
 if(/필기|인적성|ai역량검사|ai인적성|코딩테스트|시험/.test(value))return value.includes('필기')?'written':'assessment';
 if(/서류|지원서/.test(value))return'document';
 return value||'custom';
}
export function stageColumnName(name:string){switch(stageKey(name)){case'document':return name==='서류 제출'?'서류 제출':'서류';case'assessment':return name==='AI 역량검사'?'AI 역량검사':'AI·인적성';case'written':return name==='필기 전형'?'필기 전형':'필기';case'interview-1':return'1차 면접';case'interview-2':return'2차 면접';case'interview-final':return'최종면접';default:return name}}
export function columns(apps:Application[]):Column[]{
 const entries=[...standardStages,...apps.flatMap(a=>a.stages.filter(s=>s.applicable).map(s=>s.name))].map(name=>({name,stageKey:stageKey(name)}));
 const unique=[...new Map(entries.map(x=>[x.stageKey,x])).values()];
 return[{id:'preparing',name:'준비',kind:'preparing'},...unique.map(({name,stageKey:key})=>({id:'stage:'+key,name:stageColumnName(name),stageKey:key,kind:'stage' as const})),{id:'accepted',name:'최종합격',kind:'accepted'},{id:'archived',name:'종료',kind:'archived'}]
}
export function columnFor(a:Application){if(a.managementStatus==='accepted')return'accepted';if(['rejected','withdrawn'].includes(a.managementStatus))return'archived';const stage=a.stages.find(s=>s.id===a.currentStageId&&s.applicable);return stage?'stage:'+stageKey(stage.name):'preparing'}
export function moveApplication(a:Application,column:Column):Application{const next=structuredClone(a);if(column.kind==='accepted'){next.managementStatus='accepted';return next}if(column.kind==='archived')throw new Error('불합격 또는 지원 철회를 직접 선택해주세요.');if(column.kind==='preparing'){next.currentStageId=null;next.managementStatus='preparing';return next}let stage=next.stages.find(s=>stageKey(s.name)===column.stageKey&&s.applicable);if(!stage){stage=newStage(column.name,next.stages.length);next.stages.push(stage)}next.currentStageId=stage.id;next.managementStatus='active';return next}
