import { json } from './_lib/http.js';

const LEGACY_IMAGES_URL='https://app-it055u.v2.appdeploy.ai/api/site-images';

export default async function handler(req:any,res:any){
  if(req.method!=='GET') return json(res,405,{error:'Method not allowed'});
  try{
    const response=await fetch(LEGACY_IMAGES_URL,{
      headers:{Accept:'application/json'}

    });
    if(!response.ok) return json(res,200,{items:{},source:'legacy-unavailable'});
    const payload=await response.json();
    const items=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload:{};
    return json(res,200,{items,source:'legacy-storage'});
  }catch{
    return json(res,200,{items:{},source:'legacy-unavailable'});
  }
}