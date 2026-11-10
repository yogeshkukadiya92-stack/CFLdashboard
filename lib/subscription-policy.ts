export type BillingAccess={mode:"FULL"|"READ_ONLY";status:string;accessUntil:string|null;graceUntil:string|null;exportAllowed:boolean;reason:string};
export function deriveBillingAccess(profile:{status?:string;access_until?:Date|string|null;grace_until?:Date|string|null}|null,now=new Date()):BillingAccess{
  if(!profile)return{mode:"FULL",status:"legacy_active",accessUntil:null,graceUntil:null,exportAllowed:true,reason:"Legacy account pending billing migration"};
  const access=profile.access_until?new Date(profile.access_until):null,grace=profile.grace_until?new Date(profile.grace_until):null,status=String(profile.status||"expired");
  const full=status==="manual_active"&&(!access||access>now)||["authenticated","active"].includes(status)&&Boolean(access&&access>now)||status==="pending"&&Boolean(grace&&grace>now)||["cancelled","completed"].includes(status)&&Boolean(access&&access>now);
  return{mode:full?"FULL":"READ_ONLY",status,accessUntil:access?.toISOString()||null,graceUntil:grace?.toISOString()||null,exportAllowed:full,reason:full?status==="pending"?"Payment retry grace period":"Subscription active":"Subscription expired; viewing remains available"};
}
