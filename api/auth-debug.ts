export default async function handler(req:any,res:any){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  try{
    const base='https://ep-withered-flower-aeyxaru7.neonauth.c-2.us-east-2.aws.neon.tech/ashour_bukhari/auth';
    const origin='https://ashour-bukhari-cleana.vercel.app';
    const r=await fetch(base+'/sign-in/social',{
      method:'POST',
      headers:{'content-type':'application/json','origin':origin},
      body:JSON.stringify({provider:'google',callbackURL:'/'})
    });
    const text=await r.text();
    res.status(200).json({status:r.status,contentType:r.headers.get('content-type'),body:text.slice(0,2000)});
  }catch(e:any){res.status(500).json({error:e?.message||String(e)})}
}