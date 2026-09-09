import {managementLabels,stageLabels,type Application,type ManagementStatus,type StageStatus} from './applications';
export type ProgressPatch={currentStageId?:string|null;stageId?:string;stageStatus?:StageStatus;managementStatus?:ManagementStatus};
// This operation intentionally validates only progress fields, never an unsaved detail form.
export function patchProgress(original:Application,input:ProgressPatch):Application{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['currentStageId','stageId','stageStatus','managementStatus'].includes(k)))throw new Error('진행 상태 변경 값을 확인해주세요.');
 const a=structuredClone(original);
 if(Object.hasOwn(input,'currentStageId')){if(input.currentStageId!==null&&!a.stages.some(s=>s.id===input.currentStageId&&s.applicable))throw new Error('현재 전형을 확인해주세요.');a.currentStageId=input.currentStageId!}
 if(Object.hasOwn(input,'managementStatus')){if(!Object.hasOwn(managementLabels,input.managementStatus!))throw new Error('전체 관리 상태를 확인해주세요.');a.managementStatus=input.managementStatus!}
 if(Object.hasOwn(input,'stageStatus')||Object.hasOwn(input,'stageId')){
  const s=a.stages.find(s=>s.id===input.stageId);if(!s||!Object.hasOwn(stageLabels,input.stageStatus!))throw new Error('전형 상태를 확인해주세요.');
  if(input.stageStatus==='not_applicable'&&a.currentStageId===s.id)throw new Error('현재 전형을 해제한 뒤 해당 없음으로 바꿔주세요.');
  s.status=input.stageStatus!;s.applicable=s.status!=='not_applicable';
 }
 return a;
}
export function mergeProgressDraft(draft:Application,saved:Application,patch:ProgressPatch){
 const next=structuredClone(draft);
 if(Object.hasOwn(patch,'currentStageId'))next.currentStageId=saved.currentStageId;
 if(Object.hasOwn(patch,'managementStatus'))next.managementStatus=saved.managementStatus;
 if(patch.stageId){const latest=saved.stages.find(s=>s.id===patch.stageId);next.stages=next.stages.map(s=>s.id===patch.stageId&&latest?{...s,status:latest.status,applicable:latest.applicable}:s)}
 next.updatedAt=saved.updatedAt;return next;
}
