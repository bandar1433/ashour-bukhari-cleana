import { query } from './_lib/db.js';
import { getActor } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res);if(!u)return;
    await query('alter table students add column if not exists document_no text');
    await query('alter table students add column if not exists mobile text');
    if(req.method==='GET'){
      const rows=await query(`
        select s.id,s.user_id,s.center_id,s.circle_id,s.full_name,s.document_no,s.mobile,s.birth_date,s.grade_level,s.registration_date,
          us.email,coalesce(us.is_active,true) as is_active,s.status,s.points_balance,
          c.name as circle_name,ce.name as center_name
        from students s
        left join users us on us.id=s.user_id
        left join circles c on c.id=s.circle_id
        left join centers ce on ce.id=s.center_id
        where $1='system_admin'
           or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid)
           or ($1='teacher' and c.teacher_user_id=$3::uuid)
           or ($1='student' and s.user_id=$3::uuid)
        order by s.full_name limit 500
      `,[u.role,u.center_id,u.id]);
      return json(res,200,{items:rows});
    }
    if(req.method==='POST'){
      if(!['system_admin','center_manager','supervisor','teacher'].includes(u.role))return json(res,403,{error:'Forbidden',message:'إضافة الطلاب غير متاحة لهذا الحساب.'});
      const b=req.body||{};if(!b.full_name?.trim())return json(res,400,{error:'اسم الطالب مطلوب'});if(!String(b.document_no||'').trim())return json(res,400,{error:'رقم الهوية أو الوثيقة مطلوب'});if(!/^\+?[0-9]{7,15}$/.test(String(b.mobile||'').replace(/[\s-]/g,'')))return json(res,400,{error:'رقم الجوال مطلوب ويجب أن يكون رقمًا دوليًا صالحًا'});
      const duplicate=(await query<any>('select id from students where document_no=$1 limit 1',[String(b.document_no).trim()]))[0];if(duplicate)return json(res,409,{error:'رقم الهوية أو الوثيقة مسجل مسبقًا'});
      let centerId=b.center_id||u.center_id||null;
      if(b.circle_id){
        const circle=(await query<any>('select center_id,teacher_user_id from circles where id=$1',[b.circle_id]))[0];
        if(!circle)return json(res,400,{error:'الحلقة المحددة غير موجودة'});
        centerId=circle.center_id;if(u.role==='teacher'&&circle.teacher_user_id!==u.id)return json(res,403,{error:'Forbidden',message:'المعلم يضيف الطلاب إلى حلقته فقط'});
      }
      if(u.role==='teacher'&&!b.circle_id)return json(res,400,{error:'يجب ربط الطالب بحلقة المعلم'});
      if(u.role!=='system_admin'&&centerId!==u.center_id)return json(res,403,{error:'Forbidden',message:'لا يمكنك إضافة طالب خارج مركزك.'});
      const rows=await query(`
        insert into students(full_name,document_no,mobile,center_id,circle_id,birth_date,grade_level,registration_date,status)
        values($1,$2,$3,$4,$5,$6,$7,coalesce($8::date,current_date),coalesce($9::student_status,'active'::student_status))
        returning *
      `,[b.full_name.trim(),String(b.document_no).trim(),String(b.mobile).replace(/[\s-]/g,''),centerId,b.circle_id||null,b.birth_date||null,b.grade_level||null,b.registration_date||null,b.status||null]);
      return json(res,201,rows[0]);
    }
    if(req.method==='PUT'){
      if(!['system_admin','center_manager','supervisor','teacher'].includes(u.role))return json(res,403,{error:'Forbidden',message:'تعديل الطلاب غير متاح لهذا الحساب.'});
      const b=req.body||{};if(!b.id)return json(res,400,{error:'معرف الطالب مطلوب'});
      const existing=(await query<any>('select s.*,c.teacher_user_id from students s left join circles c on c.id=s.circle_id where s.id=$1',[b.id]))[0];
      if(!existing)return json(res,404,{error:'الطالب غير موجود'});
      if(u.role==='teacher'&&existing.teacher_user_id!==u.id)return json(res,403,{error:'Forbidden',message:'الطالب خارج حلقتك.'});
      if(u.role==='teacher'&&Date.now()-new Date(existing.registration_date).getTime()>7*86400000)return json(res,403,{error:'انتهت مهلة التعديل',message:'يسمح للمعلم بتعديل الطالب خلال 7 أيام من التسجيل فقط.'});
      if(['center_manager','supervisor'].includes(u.role)&&existing.center_id!==u.center_id)return json(res,403,{error:'Forbidden',message:'الطالب خارج مركزك.'});
      let centerId=b.center_id!==undefined?(b.center_id||null):existing.center_id;
      let circleId=b.circle_id!==undefined?(b.circle_id||null):existing.circle_id;
      if(circleId){
        const circle=(await query<any>('select center_id from circles where id=$1',[circleId]))[0];
        if(!circle)return json(res,400,{error:'الحلقة المحددة غير موجودة'});
        centerId=circle.center_id;
      }
      if(u.role==='teacher'&&circleId!==existing.circle_id)return json(res,403,{error:'Forbidden',message:'المعلم يستطيع تعديل بيانات الطالب داخل حلقته، ونقل الطالب بين الحلقات من صلاحية الإدارة.'});
      if(['center_manager','supervisor'].includes(u.role)&&centerId!==u.center_id)return json(res,403,{error:'Forbidden',message:'لا يمكنك نقل الطالب خارج مركزك.'});
      if(b.document_no){const duplicate=(await query<any>('select id from students where document_no=$1 and id<>$2 limit 1',[String(b.document_no).trim(),b.id]))[0];if(duplicate)return json(res,409,{error:'رقم الهوية أو الوثيقة مسجل مسبقًا'});}
      const rows=await query(`update students set full_name=coalesce($2,full_name),center_id=$3,circle_id=$4,birth_date=coalesce($5::date,birth_date),grade_level=coalesce($6,grade_level),status=coalesce($7::student_status,status),document_no=coalesce($8,document_no),mobile=coalesce($9,mobile),updated_at=now() where id=$1 returning *`,
        [b.id,b.full_name?.trim()||null,centerId,circleId,b.birth_date||null,b.grade_level||null,b.status||null,b.document_no?.trim()||null,b.mobile?String(b.mobile).replace(/[\s-]/g,''):null]);
      return json(res,200,rows[0]);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}