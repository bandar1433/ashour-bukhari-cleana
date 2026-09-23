import { query } from './_lib/db.js';
import { getActor,validUuid } from './_lib/actor.js';
import { handleError, json } from './_lib/http.js';

const kinds=new Set(['news','event','achievement','media']);
const statuses=new Set(['draft','published']);

export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res);if(!u)return;
    if(u.role!=='system_admin')return json(res,403,{error:'Forbidden',message:'إدارة محتوى الموقع العام متاحة لمدير النظام فقط.'});
    if(req.method==='GET'){
      const rows=await query(`select id,kind,title,body,image_url,video_url,event_date,status,published_at from news_events order by coalesce(event_date,published_at,created_at) desc limit 200`);
      return json(res,200,{items:rows});
    }
    if(req.method==='POST'){
      const b=req.body||{},kind=kinds.has(String(b.kind))?String(b.kind):'news',status=statuses.has(String(b.status))?String(b.status):'draft';
      const title=String(b.title||'').trim(),body=String(b.body||'').trim(),image=String(b.image_url||'').trim()||null,video=String(b.video_url||'').trim()||null,eventDate=String(b.event_date||'').trim()||null;
      if(!title)return json(res,400,{error:'عنوان الخبر مطلوب'});
      if(eventDate&&!/^\d{4}-\d{2}-\d{2}$/.test(eventDate))return json(res,400,{error:'تاريخ الفعالية غير صالح'});
      const rows=await query(`insert into news_events(kind,title,body,image_url,video_url,event_date,status,published_at)
        values($1,$2,$3,$4,$5,$6::date,$7,case when $7='published' then now() else null end)
        returning id,kind,title,body,image_url,video_url,event_date,status,published_at`,
        [kind,title,body,image,video,eventDate,status]);
      return json(res,201,rows[0]);
    }
    if(req.method==='PUT'){
      const b=req.body||{},id=validUuid(b.id);if(!id)return json(res,400,{error:'معرف الخبر غير صالح'});
      const existing=(await query<any>('select * from news_events where id=$1',[id]))[0];if(!existing)return json(res,404,{error:'الخبر غير موجود'});
      const kind=b.kind===undefined?existing.kind:(kinds.has(String(b.kind))?String(b.kind):existing.kind);
      const status=b.status===undefined?existing.status:(statuses.has(String(b.status))?String(b.status):existing.status);
      const title=b.title===undefined?existing.title:String(b.title||'').trim();
      if(!title)return json(res,400,{error:'عنوان الخبر مطلوب'});
      const eventDate=b.event_date===undefined?existing.event_date:(String(b.event_date||'').trim()||null);
      if(eventDate&&typeof eventDate==='string'&&!/^\d{4}-\d{2}-\d{2}/.test(eventDate))return json(res,400,{error:'تاريخ الفعالية غير صالح'});
      const row=(await query<any>(`update news_events set kind=$2,title=$3,body=$4,image_url=$5,video_url=$6,event_date=$7::date,status=$8,
        published_at=case when $8='published' then coalesce(published_at,now()) else null end
        where id=$1 returning id,kind,title,body,image_url,video_url,event_date,status,published_at`,
        [id,kind,title,b.body===undefined?existing.body:String(b.body||'').trim(),b.image_url===undefined?existing.image_url:(String(b.image_url||'').trim()||null),b.video_url===undefined?existing.video_url:(String(b.video_url||'').trim()||null),eventDate,status]))[0];
      return json(res,200,row);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}
