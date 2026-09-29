import {useEffect,useMemo,useState} from 'react';
import {apiGet,apiPost} from './lib/api';

export default function EvaluationCriteriaPanel({circles,month}:{circles:any[];month:string}){
 const [circleId,setCircleId]=useState(''),[data,setData]=useState<any>(null),[items,setItems]=useState<any[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const available=circles.filter(c=>c.is_active!==false);
 useEffect(()=>{if(!circleId&&available.length)setCircleId(available[0].id)},[available.length,circleId]);
 async function load(id=circleId){if(!id)return;setBusy(true);setMessage('');try{const x=await apiGet<any>(`/api/ops?action=evaluation-criteria&circle_id=${id}&month=${month}`);setData(x);setItems((x.next||[]).map((v:any)=>({...v})))}catch(e){setMessage(e instanceof Error?e.message:'تعذر تحميل المعايير')}finally{setBusy(false)}}
 useEffect(()=>{if(circleId)void load(circleId)},[circleId,month]);
 const total=useMemo(()=>Math.round(items.reduce((n,x)=>n+Number(x.weight||0),0)*100)/100,[items]);
 function change(i:number,key:string,value:any){setItems(x=>x.map((r,j)=>j===i?{...r,[key]:value}:r))}
 function add(){setItems(x=>[...x,{name:'مراجعة '+Math.max(2,x.filter(y=>y.kind==='quran').length),kind:'quran',system_key:null,weight:10,target_pages:10}])}
 function remove(i:number){setItems(x=>x.filter((_,j)=>j!==i))}
 function move(i:number,dir:number){setItems(x=>{const j=i+dir;if(j<0||j>=x.length)return x;const y=[...x],[v]=y.splice(i,1);y.splice(j,0,v);return y})}
 async function save(){if(total!==100){setMessage('مجموع الأوزان يجب أن يساوي 100% قبل الحفظ.');return}setBusy(true);setMessage('');try{const x=await apiPost<any>('/api/ops?action=evaluation-criteria',{circle_id:circleId,base_month:month,criteria:items});setItems((x.items||[]).map((v:any)=>({...v})));setMessage(x.message||'تم الحفظ.');await load(circleId)}catch(e){setMessage(e instanceof Error?e.message:'تعذر حفظ المعايير')}finally{setBusy(false)}}
 return <section className="criteriaManager">
  <div className="criteriaManagerHead"><div><span className="panelEyebrow">إعدادات سجل الحلقة</span><h3>معايير التقييم الآلي</h3><p>المعلم يحدد المعايير والمطلوب والأوزان فقط؛ لا توجد درجات جودة أو تقييم يومي يدوي.</p></div><label className="field"><span>الحلقة</span><select value={circleId} onChange={e=>setCircleId(e.target.value)}>{available.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
  {data&&<div className="criteriaEffective"><span>المطبق الآن: <b>{data.current_month}</b></span><span>التعديل سيطبق من: <b>{data.next_month}</b></span></div>}
  {message&&<div className="notice">{message}</div>}
  <div className="table-wrap"><table className="criteriaTable"><thead><tr><th>المعيار</th><th>النوع</th><th>المطلوب يوميًا</th><th>الوزن</th><th>الترتيب</th><th></th></tr></thead><tbody>{items.map((x,i)=><tr key={x.id||'new-'+i}><td><input value={x.name} onChange={e=>change(i,'name',e.target.value)} /></td><td>{x.system_key?<b>{x.system_key==='attendance'?'حضور وانضباط':'قرآني أساسي'}</b>:<select value={x.kind} onChange={e=>change(i,'kind',e.target.value)}><option value="quran">قرآني</option><option value="task">إنجاز/مهمة</option></select>}</td><td>{x.kind==='quran'&&!x.system_key?<div className="criterionTarget"><input type="number" min="1" step="1" value={x.target_pages} onChange={e=>change(i,'target_pages',e.target.value)}/><span>صفحة</span></div>:x.system_key==='new'||x.system_key==='review'?<small>حسب خطة الطالب</small>:<small>تلقائي</small>}</td><td><div className="criterionWeight"><input type="number" min="1" max="100" step="0.5" value={x.weight} onChange={e=>change(i,'weight',e.target.value)}/><span>%</span></div></td><td><div className="criterionOrder"><button type="button" className="secondary" onClick={()=>move(i,-1)}>↑</button><button type="button" className="secondary" onClick={()=>move(i,1)}>↓</button></div></td><td>{!x.system_key&&<button type="button" className="dangerText" onClick={()=>remove(i)}>حذف</button>}</td></tr>)}</tbody></table></div>
  <div className="criteriaFooter"><button type="button" className="secondary" onClick={add}>＋ إضافة معيار</button><div className={total===100?'criteriaTotal valid':'criteriaTotal invalid'}>مجموع الأوزان <b>{total}%</b></div><button type="button" className="primary" disabled={busy||total!==100} onClick={save}>{busy?'جارٍ الحفظ…':'حفظ للشهر القادم'}</button></div>
 </section>
}
