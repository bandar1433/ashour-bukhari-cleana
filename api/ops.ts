import { getActor } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

import { summary,teacherToday,circleRegister,evaluations,studentProfile,dayApprove } from './_ops/teacher.js';
import { selfService } from './_ops/student.js';
import { joinRequests,motivation,notifications,competitions } from './_ops/engagement.js';
import { managementReport,adminOperations } from './_ops/admin.js';
import { features,profile } from './_ops/features.js';















export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res);if(!u)return;
    const action=String(req.query?.action||'');
    if(action==='summary')return summary(req,res,u);
    if(action==='teacher-today')return teacherToday(req,res,u);
    if(action==='circle-register')return circleRegister(req,res,u);
    if(action==='evaluations')return evaluations(req,res,u);
    if(action==='student-profile')return studentProfile(req,res,u);
    if(action==='day-approve')return dayApprove(req,res,u);
    if(action==='self-service')return selfService(req,res,u);
    if(action==='join-requests')return joinRequests(req,res,u);
    if(action==='motivation')return motivation(req,res,u);
    if(action==='notifications')return notifications(req,res,u);
    if(action==='competitions')return competitions(req,res,u);
    if(action==='management-report')return managementReport(req,res,u);
    if(action==='admin-operations')return adminOperations(req,res,u);
    if(action==='features')return features(req,res,u);
    if(action==='profile')return profile(req,res,u);
    return json(res,404,{error:'Unknown operation'});
  }catch(e){return handleError(res,e)}
}
