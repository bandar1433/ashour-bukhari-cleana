import { json } from './_lib/http.js';

export default async function handler(req:any,res:any){
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
  return json(res,200,{ok:true,mode:'auth-clean-probe'});
}
