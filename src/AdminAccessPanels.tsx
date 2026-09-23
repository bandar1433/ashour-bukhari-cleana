import { useEffect,useState } from 'react';
import { apiPut, type UserRow } from './lib/api';

const roleLabel:Record<string,string>={system_admin:'مدير النظام',center_manager:'مدير المركز',supervisor:'مشرف',teacher:'معلم',student:'طالب',guardian:'ولي أمر'};

export function LoginRequestsPanel({rows,users,onChanged}:{rows:any[];users:UserRow[];onChanged:()=>Promise<void>}){
  const [targets,setTargets]=useState<Record<string,string>>({});
  if(!rows.length) return <section className="panel" style={{marginTop:18}}><h3>طلبات ربط الدخول</h3><div className="empty">لا توجد طلبات اعتماد معلقة.</div></section>;
  async function approve(row:any){
    const matched=users.find(u=>(u.email||'').toLowerCase()===String(row.email||'').toLowerCase());
    const target=targets[row.id]||matched?.id||'';
    if(!target){alert('اختر حساب المنصة الذي تريد ربطه بهذا الدخول.');return;}
    try{
      await apiPut('/api/users',{id:target,auth_subject:row.auth_subject,request_id:row.id,role:row.requested_role||undefined,phone:row.phone||undefined,center_id:row.center_id||undefined,is_active:true});
      await onChanged();
    }catch(err){alert(err instanceof Error?err.message:'تعذر اعتماد الربط');}
  }
  return <section className="panel" style={{marginTop:18}}>
    <div className="panelHead"><div><h3>طلبات ربط الدخول</h3><small>لا يتم منح أي صلاحية قبل اعتماد الربط يدويًا.</small></div><b>{rows.length}</b></div>
    <div className="table-wrap"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الدور المطلوب</th><th>تاريخ الطلب</th><th>ربط بحساب المنصة</th><th>الإجراء</th></tr></thead><tbody>
      {rows.map(row=>{const matched=users.find(u=>(u.email||'').toLowerCase()===String(row.email||'').toLowerCase());const selected=targets[row.id]||matched?.id||'';return <tr key={row.id}>
        <td>{row.full_name||'—'}</td><td>{row.email}</td><td>{roleLabel[row.requested_role]||row.requested_role||'—'}</td><td>{row.requested_at?new Date(row.requested_at).toLocaleString('ar-SA'):'—'}</td>
        <td><select value={selected} onChange={e=>setTargets(x=>({...x,[row.id]:e.target.value}))}><option value="">اختر الحساب</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name} — {roleLabel[u.role]||u.role}{u.email?` — ${u.email}`:''}</option>)}</select></td>
        <td><button className="primary" type="button" onClick={()=>approve(row)}>اعتماد الربط</button></td>
      </tr>})}
    </tbody></table></div>
  </section>;
}
export function RolesPanel({data,onChanged}:{data:any;onChanged:()=>Promise<void>}){
  const [draft,setDraft]=useState<Record<string,string[]>>({});
  useEffect(()=>{const next:Record<string,string[]>={};for(const r of data.roles||[])next[r.code]=[...(r.permissions||[])];setDraft(next)},[data]);
  const permissions=data.permissions||[];
  async function save(role:string){await apiPut('/api/roles',{role_code:role,permissions:draft[role]||[]});await onChanged();}
  function toggle(role:string,code:string,checked:boolean){setDraft(prev=>({...prev,[role]:checked?[...(prev[role]||[]),code]:(prev[role]||[]).filter(x=>x!==code)}))}
  return <div className="rolesMatrix">{(data.roles||[]).map((r:any)=><section className="panel" key={r.code}><div className="panelHead"><div><h2>{r.name}</h2><small>{r.code==='system_admin'?'صلاحيات كاملة ثابتة':'حدد الصلاحيات المتاحة لهذا الدور'}</small></div>{r.code!=='system_admin'&&<button className="primary" onClick={()=>save(r.code)}>حفظ الصلاحيات</button>}</div><div className="featureGrid">{permissions.map((p:any)=><label className="field" key={p.code}><span><input type="checkbox" disabled={r.code==='system_admin'} checked={r.code==='system_admin'||(draft[r.code]||[]).includes(p.code)} onChange={e=>toggle(r.code,p.code,e.target.checked)} /> {p.name}</span><small>{p.category}</small></label>)}</div></section>)}</div>
}
