import { useMemo,useState } from 'react';
import { findPage,getAyahCountInSurah } from 'quran-meta/hafs';

const ARABIC_SURAH_NAMES=["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"] as const;
export function madinahSurahName(n:number){const index=Math.min(114,Math.max(1,Number(n||1)))-1;return ARABIC_SURAH_NAMES[index]||'سورة';}
const surahs=Array.from({length:114},(_,i)=>{const n=i+1;return {n,name:madinahSurahName(n),ayahs:Number(getAyahCountInSurah(n as any))}});
export type MushafRange={surah_no:number;from_ayah:number;to_surah_no:number;to_ayah:number;from_page:number;to_page:number;page_count:number};

const clampPage=(v:any)=>Math.min(604,Math.max(1,Math.round(Number(v)||1)));
function pageOf(s:number,a:number,end=false){const ayah=a>0?a:(end?Number(getAyahCountInSurah(s as any)):1);return Number(findPage(s as any,ayah as any))}
function surahsOnPage(page:number){const p=clampPage(page),matches=surahs.filter(s=>p>=pageOf(s.n,1)&&p<=pageOf(s.n,s.ayahs));if(matches.length)return matches;let fallback=surahs[0];for(const s of surahs){if(pageOf(s.n,1)<=p)fallback=s;else break}return [fallback]}
export function madinahSurahForPage(page:number,edge:'start'|'end'='start'){const list=surahsOnPage(page);return edge==='end'?list[list.length-1].n:list[0].n}

export function MadinahMushafRange({initial,onChange,prefix='' }:{initial?:Partial<MushafRange>;onChange?:(v:MushafRange)=>void;prefix?:string}){
 const initialFromS=Number(initial?.surah_no||1),initialToS=Number(initial?.to_surah_no||initial?.surah_no||1),initialFromA=Number(initial?.from_ayah||0),initialToA=Number(initial?.to_ayah||0);
 const [fromS,setFromS]=useState(initialFromS),[fromA,setFromA]=useState(initialFromA),[toS,setToS]=useState(initialToS),[toA,setToA]=useState(initialToA);
 const [fromP,setFromP]=useState(clampPage(initial?.from_page||pageOf(initialFromS,initialFromA))),[toP,setToP]=useState(clampPage(initial?.to_page||pageOf(initialToS,initialToA,true)));
 const field=(name:string)=>prefix?prefix+'_'+name:name;
 const val=useMemo(()=>({surah_no:fromS,from_ayah:fromA,to_surah_no:toS,to_ayah:toA,from_page:fromP,to_page:toP,page_count:Math.max(1,toP-fromP+1)}),[fromS,fromA,toS,toA,fromP,toP]);
 const emit=(v:Partial<MushafRange>)=>onChange?.({...val,...v});
 function setFS(n:number){const p=pageOf(n,1);setFromS(n);setFromA(0);setFromP(p);if(p>toP){setToP(p);setToS(madinahSurahForPage(p,'end'));setToA(0)}emit({surah_no:n,from_ayah:0,from_page:p})}
 function setFA(a:number){const p=pageOf(fromS,a);setFromA(a);setFromP(p);if(p>toP){setToP(p);setToS(madinahSurahForPage(p,'end'));setToA(0)}emit({from_ayah:a,from_page:p})}
 function setTS(n:number){const p=Math.max(fromP,pageOf(n,Number(getAyahCountInSurah(n as any)),true));setToS(n);setToA(0);setToP(p);emit({to_surah_no:n,to_ayah:0,to_page:p})}
 function setTA(a:number){const p=Math.max(fromP,pageOf(toS,a,true));setToA(a);setToP(p);emit({to_ayah:a,to_page:p})}
 function setFP(v:any){const p=clampPage(v),s=madinahSurahForPage(p,'start');setFromP(p);setFromS(s);setFromA(0);let nextTo=toP;if(p>toP){nextTo=p;setToP(p);setToS(madinahSurahForPage(p,'end'));setToA(0)}emit({from_page:p,surah_no:s,from_ayah:0,to_page:nextTo})}
 function setTP(v:any){const p=Math.max(fromP,clampPage(v)),s=madinahSurahForPage(p,'end');setToP(p);setToS(s);setToA(0);emit({to_page:p,to_surah_no:s,to_ayah:0})}
 return <div className="mushafRange">
  <label className="field"><span>من سورة</span><select name={field('surah_no')} value={fromS} onChange={e=>setFS(+e.target.value)}>{surahs.map(s=><option key={s.n} value={s.n}>{s.name}</option>)}</select></label>
  <label className="field"><span>من صفحة</span><input name={field('from_page')} type="number" min="1" max="604" step="1" value={fromP} onChange={e=>setFP(e.target.value)}/><small className="pageSurahHint">سورة {madinahSurahName(fromS)}</small></label>
  <label className="field"><span>من آية (اختياري)</span><select name={field('from_ayah')} value={fromA} onChange={e=>setFA(+e.target.value)}><option value={0}>اختياري</option>{Array.from({length:surahs[fromS-1].ayahs},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
  <label className="field"><span>إلى سورة</span><select name={field('to_surah_no')} value={toS} onChange={e=>setTS(+e.target.value)}>{surahs.map(s=><option key={s.n} value={s.n} disabled={s.n<fromS}>{s.name}</option>)}</select></label>
  <label className="field"><span>إلى صفحة</span><input name={field('to_page')} type="number" min={fromP} max="604" step="1" value={toP} onChange={e=>setTP(e.target.value)}/><small className="pageSurahHint">سورة {madinahSurahName(toS)}</small></label>
  <label className="field"><span>إلى آية (اختياري)</span><select name={field('to_ayah')} value={toA} onChange={e=>setTA(+e.target.value)}><option value={0}>اختياري</option>{Array.from({length:surahs[toS-1].ayahs},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
  <label className="field"><span>عدد الصفحات</span><input value={Math.max(1,toP-fromP+1)} readOnly/></label>
 </div>
}