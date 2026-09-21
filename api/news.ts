import { query } from './_lib/db.js';
import { handleError, json, requireAccess } from './_lib/http.js';

export default async function handler(req:any,res:any){
  if(!requireAccess(req,res)) return;
  try{
    if(req.method==='GET'){
      const rows=await query(`select id,kind,title,body,image_url,video_url,event_date,status,published_at from news_events order by coalesce(event_date,created_at) desc limit 200`);
      return json(res,200,{items:rows});
    }
    if(req.method==='POST'){
      const {kind='news',title,body='',image_url=null,video_url=null,event_date=null,status='draft'}=req.body||{};
      if(!title?.trim()) return json(res,400,{error:'عنوان الخبر مطلوب'});
      const rows=await query(`insert into news_events(kind,title,body,image_url,video_url,event_date,status,published_at)
        values($1,$2,$3,$4,$5,$6,$7,case when $7='published' then now() else null end)
        returning id,kind,title,body,image_url,video_url,event_date,status,published_at`,
        [kind,title.trim(),body,image_url,video_url,event_date,status]);
      return json(res,201,rows[0]);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}