import { useMemo,useState } from 'react';
import { findPage,getAyahCountInSurah,getSurahInfo } from 'quran-meta/hafs';

export function madinahSurahName(n:number){const info:any=getSurahInfo(Number(n||1) as any);return String(info?.name?.arabic||info?.arabicName||info?.name||'سورة');}
const surahs=Array.from({length:114},(_,i)=>{const n=i+1;return {n,name:madinahSurahName(n),ayahs:getAyahCountInSurah(n as any)}});

export type MushafRange={surah_no:number;from_ayah:number;to_surah_no:number;to_ayah:number;from_page:number;to_page:number;page_count:number};

function pageOf(s:number,a:number){return Number(findPage(s as any,a as any));}
export function MadinahMushafRange({initial,onChange}:{initial?:Partial<MushafRange>;onChange?:(v:MushafRange)=>void}){
 const [fromS,setFromS]=useState(Number(initial?.surah_no||1)),[fromA,setFromA]=useState(Number(initial?.from_ayah||1));
 const [toS,setToS]=useState(Number(initial?.to_surah_no||initial?.surah_no||1)),[toA,setToA]=useState(Number(initial?.to_ayah||1));
 const fp=useMemo(()=>pageOf(fromS,fromA),[fromS,fromA]),tp=useMemo(()=>pageOf(toS,toA),[toS,toA]);
 const val={surah_no:fromS,from_ayah:fromA,to_surah_no:toS,to_ayah:toA,from_page:fp,to_page:tp,page_count:Math.max(1,tp-fp+1)};
 function emit(v:Partial<MushafRange>){const x={...val,...v} as MushafRange;onChange?.(x)}
 function setFS(n:number){setFromS(n);const a=1;setFromA(a);if(toS<n){setToS(n);setToA(1)};emit({surah_no:n,from_ayah:a,to_surah_no:toS<n?n:toS,to_ayah:toS<n?1:toA,from_page:pageOf(n,a)})}
 function setFA(a:number){setFromA(a);emit({from_ayah:a,from_page:pageOf(fromS,a)})}
 function setTS(n:number){setToS(n);setToA(1);emit({to_surah_no:n,to_ayah:1,to_page:pageOf(n,1)})}
 function setTA(a:number){setToA(a);emit({to_ayah:a,to_page:pageOf(toS,a)})}
 return <div className="mushafRange">
  <label className="field"><span>من سورة</span><select name="surah_no" value={fromS} onChange={e=>setFS(+e.target.value)}>{surahs.map(s=><option key={s.n} value={s.n}>{s.name}</option>)}</select></label>
  <label className="field"><span>من آية</span><select name="from_ayah" value={fromA} onChange={e=>setFA(+e.target.value)}>{Array.from({length:surahs[fromS-1].ayahs},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label>
  <label className="field"><span>من صفحة</span><input name="from_page" value={fp} readOnly/></label>
  <label className="field"><span>إلى سورة</span><select name="to_surah_no" value={toS} onChange={e=>setTS(+e.target.value)}>{surahs.map(s=><option key={s.n} value={s.n}>{s.name}</option>)}</select></label>
  <label className="field"><span>إلى آية</span><select name="to_ayah" value={toA} onChange={e=>setTA(+e.target.value)}>{Array.from({length:surahs[toS-1].ayahs},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label>
  <label className="field"><span>إلى صفحة</span><input name="to_page" value={tp} readOnly/></label>
  <label className="field"><span>عدد الصفحات</span><input value={Math.max(1,tp-fp+1)} readOnly/></label>
 </div>
}
