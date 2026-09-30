import { query } from './_lib/db.js';
import { handleError,json } from './_lib/http.js';

async function persistedImages(){
  try{
    await query("CREATE TABLE IF NOT EXISTS legacy_site_images(image_key text PRIMARY KEY,content text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())");
    const rows=await query<any>("SELECT image_key,content FROM legacy_site_images");
    const images:Record<string,string>={};
    for(const row of rows){
      const raw=String(row.content||'').trim();
      if(raw)images[row.image_key]=raw.startsWith('data:')?raw:'data:image/jpeg;base64,'+raw;
    }
    return images;
  }catch{return {};}
}

export default async function handler(req:any,res:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  try{
    const [stats,news,circles,centers,library,images]=await Promise.all([
      query<any>("select (select count(*) from students where status='active')::int students,(select count(*) from users where role='teacher' and is_active)::int teachers,(select count(*) from circles where is_active)::int circles,(select count(*) from centers where is_active)::int centers"),
      query("select id,kind,title,body,image_url,video_url,event_date,published_at from news_events where status='published' order by coalesce(published_at,event_date,created_at) desc limit 12"),
      query("select c.id,c.name,c.center_id,c.age_stage,c.schedule,c.student_track,c.quran_track,ce.name center_name,coalesce((select string_agg(t.full_name,'، ' order by ct.is_primary desc,t.full_name) from circle_teachers ct join users t on t.id=ct.teacher_user_id where ct.circle_id=c.id),'') teacher_name from circles c left join centers ce on ce.id=c.center_id where c.is_active order by ce.name,c.name limit 100"),
      query("select id,name from centers where is_active order by name"),
      query("select id,program_name,series_name,title,teacher_name,description,duration,item_type,coalesce(nullif(resource_url,''),nullif(youtube_url,'')) resource_url,image_url,sort_order from library_items where is_active and public_visible order by sort_order,title limit 100"),
      persistedImages()
    ]);
    return json(res,200,{stats:stats[0],news,circles,centers,library,images});
  }catch(e){return handleError(res,e)}
}
