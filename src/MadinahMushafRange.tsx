import { useMemo,useState } from 'react';
import { findPage,getAyahCountInSurah } from 'quran-meta/hafs';

const ARABIC_SURAH_NAMES=["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"] as const;
export function madinahSurahName(n:number){const index=Math.min(114,Math.max(1,Number(n||1)))-1;return ARABIC_SURAH_NAMES[index]||'سورة';}
const surahs=Array.from({length:114},(_,i)=>{const n=i+1;return {n,name:madinahSurahName(n),ayahs:getAyahCountInSurah(n as any)}});

export type MushafRange={surah_no:number;from_ayah:number;to_surah_no:number;to_ayah:number;from_page:number;to_page:number;page_count:number};

function effectiveAyah(s:number,a:number,end=false){return a>0?a:(end?Number(getAyahCountInSurah(s as any)):1)}
function pageOf(s:number,a:number,end=false){return Number(findPage(s as any,effectiveAyah(s,a,end) as any));}
export function MadinahMushafRange({initial,onChange}:{initial?:Partial<MushafRange>;onChange?:(v:MushafRange)=>void}){
 const [fromS,setFromS]=useState(Number(initial?.surah_no||1)),[fromA,setFromA]=useState(Number(initial?.from_ayah||0));
 const [toS,setToS]=useState(Number(initial?.to_surah_no||initial?.surah_no||1)),[toA,setToA]=useState(Number(initial?.to_ayah||0));
 const fp=useMemo(()=>pageOf(fromS,fromA),[fromS,fromA]),tp=useMemo(()=>pageOf(toS,toA,true),[toS,toA]);
 const val={surah_no:fromS,from_ayah:fromA,to_surah_no:toS,to_ayah:toA,from_page:fp,to_page:tp,page_count:Math.max(1,tp-fp+1)};
 function emit(v:Partial<MushafRange>){const x={...val,...v} as MushafRange;onChange?.(x)}
 function setFS(n:number){setFromS(n);setFromA(0);if(toS<n){setToS(n);setToA(0)};emit({surah_no:n,from_ayah:0,to_surah_no:toS<n?n:toS,to_ayah:toS<n?0:toA,from_page:pageOf(n,0)})}
 function setFA(a:number){setFromA(a);emit({from_ayah:a,from_page:pageOf(fromS,a)})}
 function setTS(n:number){setToS(n);setToA(0);emit({to_surah_no:n,to_ayah:0,to_page:pageOf(n,0,true)})}
 function setTA(a:number){setToA(a);emit({to_ayah:a,to_page:pageOf(toS,a,true)})}
 return <div className="mushafRange">
  <label className="field"><span>من سورة</span><select name="surah_no" value={fromS} onChange={e=>setFS(+e.target.value)}>{surahs.map(s=><option key={s.n} value={s.n}>{s.name}</option>)}</select></label>
  <label className="field"><span>من صفحة</span><input name="from_page" value={fp} readOnly/></label>
  <label className="field"><span>من آية (اختياري)</span><select name="from_ayah" value={fromA} onChange={e=>setFA(+e.target.value)}><option value={0}>اختياري</option>{Array.from({length:surahs[fromS-1].ayahs},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
  <label className="field"><span>إلى سورة</span><select name="to_surah_no" value={toS} onChange={e=>setTS(+e.target.value)}>{surahs.map(s=><option key={s.n} value={s.n} disabled={s.n<fromS}>{s.name}</option>)}</select></label>
  <label className="field"><span>إلى صفحة</span><input name="to_page" value={tp} readOnly/></label>
  <label className="field"><span>إلى آية (اختياري)</span><select name="to_ayah" value={toA} onChange={e=>setTA(+e.target.value)}><option value={0}>اختياري</option>{Array.from({length:surahs[toS-1].ayahs},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
  <label className="field"><span>عدد الصفحات (تقريبي)</span><input value={Math.max(1,tp-fp+1)} readOnly/></label>
 </div>
}
