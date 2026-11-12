// Domain normalization for routing and structured fields. Raw ASR stays intact.
const digits={'零':'0','〇':'0','○':'0','一':'1','二':'2','兩':'2','两':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','幺':'1'};
export function spokenNumber(text){
 if(!/[十百千]/.test(text))return [...text].map(c=>digits[c]??c).join('');
 let total=0,current=0;for(const c of text){if(digits[c]!==undefined)current=Number(digits[c]);else if(/[十百千]/.test(c)){total+=(current||1)*({十:10,百:100,千:1000}[c]);current=0;}}return String(total+current);
}
export function normalizeCallText(text){
 let value=text.replace(/工单/g,'工單').replace(/最旧/g,'最舊').replace(/查询/g,'查詢').replace(/这个月/g,'這個月').replace(/这月/g,'這月').replace(/帮/g,'幫').replace(/设备/g,'設備').replace(/编号/g,'編號').replace(/维修/g,'維修').replace(/项目/g,'項目').replace(/数量/g,'數量').replace(/名称/g,'名稱').replace(/测试/g,'測試').replace(/结果/g,'結果').replace(/没有/g,'沒有').replace(/问题/g,'問題').replace(/试机/g,'試機').replace(/起机/g,'起機').replace(/确认/g,'確認').replace(/正确/g,'正確').replace(/备注/g,'備註').replace(/回报/g,'回報').replace(/台积电/g,'台積電').replace(/号/g,'號').replace(/个/g,'個').replace(/时间/g,'時間').replace(/为/g,'為');
 const numbers='[零〇○一二兩两三四五六七八九幺十百千]+';
 value=value.replace(/五年一[维維]/g,'五年一維');
 value=value.replace(new RegExp(`(${numbers})(?=年|月|日|號|個)`,'g'),(match,n,offset)=>value.slice(offset,offset+4)==='五年一維'?match:spokenNumber(n));
 value=value.replace(/(?<![A-Za-z0-9])([A-Za-z]{1,2})[\s>]*([0-9零〇○一二兩两三四五六七八九幺](?:\s*[0-9零〇○一二兩两三四五六七八九幺])+)/g,(_,prefix,n)=>prefix+spokenNumber(n.replace(/\s/g,'')));
 value=value.replace(new RegExp(`((?:工單編號|設備編號|編號|維修項目|數量|SN)[：:是為\\s]*?)(${numbers})`,'gi'),(_,label,n)=>label+spokenNumber(n));
 return value;
}
const negative=/不正確|不對|有誤|錯誤|尚未|未確認|不正常|異常|不要|取消|不用|不需要|無需|還沒|還未/;
export const confirmsStartup=raw=>{const text=normalizeCallText(raw);return !negative.test(text)&&!/[？?]|查詢|如何|怎麼/.test(text)&&/(?:起機(?:測試)?|試機|測試)(?:結果)?\s*(?:都|是|為|很)?\s*(?:正常|沒問題|沒有問題)/.test(text);};
export const isReport=raw=>{const text=normalizeCallText(raw);return /回報工單|增加工單|新增工單|建立工單|工單回報/.test(text)&&!/如何|怎麼|流程|規則|查詢/.test(text);};
export function identifiers(raw){
 return [...normalizeCallText(raw).matchAll(/(?<![A-Za-z0-9_/-])([A-Za-z]{1,6}\d[A-Za-z0-9_/-]*)(?![A-Za-z0-9_/-])/g)].map(m=>m[1]);
}
export function fanItems(text){
 const items=new Map();
 for(const line of normalizeCallText(text).split(/[\n；;]/)){
  const devices=[...line.matchAll(/(?<![A-Za-z0-9_/-])([A-Za-z]{1,6}\d[A-Za-z0-9_/-]*)(?![A-Za-z0-9_/-])/g)].filter(m=>/[-_/]/.test(m[1]));
  for(const m of line.matchAll(/([^，,、。\s]*?)FAN\s*(\d+)\s*(?:個|台|組|顆)?/gi)){
   const device=devices.filter(d=>d.index<=m.index).at(-1)?.[1]||'';
   const type=m[1].replace(/^.*?(?:更換|更换)/,'');
   items.set(device.toUpperCase()+'|'+type,{設備編號:device,類型:type,數量:Number(m[2])});
  }
 }
 return [...items.values()];
}
function localMonth(now){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}`;}
export function lookupIntent(raw,previous=null,now=new Date()){
 const text=normalizeCallText(raw);
 if(isReport(text)||/流程|規則|SOP|(?:如何|怎麼).*(?:回報|新增)/i.test(text))return null;
 const codes=identifiers(text);
 const fanQuestion=/FAN.*(?:幾|多少|數量)|(?:幾|多少).*FAN/i.test(text);
 const detailQuestion=/內容|明細|詳情|細節|呢[？?。\s]*$/.test(text)||fanQuestion;
 const explicit=/[工公]單/.test(text)&&/最新|最舊|最早|最近|列出|所有|全部|清單|查詢|哪些|歷史|找出|內容|明細|詳情|細節/.test(text);
 const shortSelection=/^(?:那|我要|我想|查詢|查|看|請|幫我|直接|的|呢|是|[。？?，,\s])*(?:最新|最舊|最早|全部|所有)(?:的|呢|是|[。？?，,\s])*$/u.test(text);
 const dateOnly=/^(?:(?:\d{4}年)?\d{1,2}月|\d{4}-\d{2}|這個月|這月|本月|上個月)(?:的|呢|是|[。？?，,\s])*$/u.test(text);
 if(!explicit&&!shortSelection&&!(previous&&dateOnly)&&!(detailQuestion&&(codes.length||fanQuestion||/[工公]單/.test(text))))return null;
 const ranked=/最舊|最早|最新|最近|全部|所有|列出|清單/.test(text);
 const selection=/最舊|最早/.test(text)?'oldest':/最新|最近/.test(text)?'newest':/全部|所有|列出|清單/.test(text)?'all':detailQuestion&&codes.length?'details':previous?.selection??'all';
 const reference=codes[0]||(!ranked?previous?.reference:null)||null;
 const view=fanQuestion?'fans':detailQuestion?'details':null;
 const ym=text.match(/(\d{4})[年/-](\d{1,2})(?:月|(?=$|[的。？?\s]))/);
 const monthOnly=text.match(/(?:^|[^\d])(\d{1,2})月/);
 let period=reference?null:previous?.period??null;
 if(ym)period=`${ym[1]}-${ym[2].padStart(2,'0')}`;
 else if(/這個月|這月|本月/.test(text))period=localMonth(now);
 else if(/上個月/.test(text)){const [y,m]=localMonth(now).split('-').map(Number);period=`${m===1?y-1:y}-${String(m===1?12:m-1).padStart(2,'0')}`;}
 else if(monthOnly)period=`${(previous?.period??localMonth(now)).slice(0,4)}-${monthOnly[1].padStart(2,'0')}`;
 if(/全部時間|不限日期|所有日期|歷年/.test(text))period=null;
 if(period&&!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(period))return {selection,period,invalidPeriod:true,query:'查詢工單：無效月份'};
 return {selection,period,reference,view,query:`查詢${{newest:'最新',oldest:'最舊',all:'全部',details:'明細'}[selection]}工單${reference?' '+reference:''}${view==='fans'?' FAN數量幾個':view==='details'?' 內容':''}${period?' '+period.slice(0,4)+'年'+Number(period.slice(5))+'月':''}`};
}
export function resolveLookup(text,history=[],now=new Date()){
 let previous=null;
 const earlier=[...history];if(earlier.at(-1)===text)earlier.pop();
 for(const turn of earlier){if(isReport(turn))previous=null;else previous=lookupIntent(turn,previous,now)??previous;
  if(!previous&&history.some(isReport)){const reference=identifiers(turn)[0];if(reference)previous={selection:'details',period:null,reference};}
 }
 return lookupIntent(text,previous,now);
}
export function reportDate(raw,now=new Date()){
 const text=normalizeCallText(raw);
 for(const match of text.matchAll(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})(?:日|號)?/g)){
  if(/製造|MFD/i.test(text.slice(Math.max(0,match.index-12),match.index)))continue;
  const date=`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
  if(!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date)return date;
 }
 const partial=text.match(/(?:^|[^\d])(\d{1,2})月(\d{1,2})(?:日|號)/);
 if(partial){const date=`${localMonth(now).slice(0,4)}-${partial[1].padStart(2,'0')}-${partial[2].padStart(2,'0')}`;if(!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date)return date;}
 return '';
}
export function reportDraft(history,now=new Date()){
 let start=history.findLastIndex(isReport);
 if(start<0)start=history.findIndex(raw=>{const t=normalizeCallText(raw);return !/[？?]|查詢|請問|如何|怎麼|流程|規則|SOP/.test(t)&&/設備編號|維修項目|數量|更換|保養|維修/.test(t);});
 if(start<0)return null;
 const previous=history.slice(0,start).findLastIndex(isReport);
 if(previous===start-1&&previous>=0&&/^(?:我(?:想要|想|要)?|請|幫我)?(?:回報工單|增加工單|新增工單|建立工單|工單回報)[。！!，,\s]*$/.test(normalizeCallText(history[previous])))start=previous;
 const turns=history.slice(start),normalized=turns.map(t=>normalizeCallText(t).replace(/([A-Z]\d{2,}5)年一維/g,'$1，五年一維')); // ASR may merge the final 5 with 五年一維.
 const cancelled=normalized.some(t=>/取消(?:回報|工單)|不要(?:新增|儲存|回報)|不用(?:新增|儲存)/.test(t));
 const detailTurns=normalized.filter(t=>!lookupIntent(t)&&!confirmsStartup(t)&&!/^(?:正確|確認|是的|沒錯)[。！!\s]*$/.test(t));
 const date=detailTurns.map(t=>reportDate(t,now)).find(Boolean)||'';
 const details=detailTurns.filter(t=>!/^\s*(?:我(?:想要|想|要)?|請|幫我)?(?:回報工單|增加工單|新增工單|建立工單|工單回報)[。！!，,\s]*$/.test(t));
 const content=details.join('；');
 const field=label=>content.match(new RegExp(`(?:${label})[：:是為\\s]*([^，,。；;\\n]+)`))?.[1]?.trim()||'';
 const fields={工單編號:field('工單編號|單號|(?<!設備)編號'),工單名稱:field('工單名稱|名稱'),設備編號:field('設備編號'),維修項目:field('維修項目'),數量:field('數量')};
 if(!fields.工單編號){fields.工單編號=content.match(/(?<![A-Za-z0-9])([A-Za-z]{1,4}[0-9][A-Za-z0-9_/-]*)(?![A-Za-z0-9_/-])/u)?.[1]||'';}
 const equipment=[...new Set(identifiers(content).filter(id=>/[-_/]/.test(id)))];
 if(!fields.設備編號)fields.設備編號=equipment.join('、');
 const maintenance=content.match(/五年一維/)?.[0]||'';
 if(!fields.維修項目&&maintenance)fields.維修項目=maintenance;
 const items=fanItems(content);
 const fan=items.length?String(items.reduce((sum,item)=>sum+item.數量,0)):'';
 if(!fields.數量&&fan)fields.數量=fan;
 return {start,turns,date,details:content,fields,fanQuantity:fan,fanItems:items,cancelled};
}
export function callDecision(history,now=new Date()){
 const text=history.at(-1),lookup=resolveLookup(text,history,now);
 if(lookup)return {intent:'lookup',tool:'retrieve_knowledge',query:lookup.query,selection:lookup.selection,period:lookup.period,reference:lookup.reference,view:lookup.view,...(lookup.invalidPeriod?{report_reply:'沒有查到該月份的工單記錄。'}:{})};
 if(!isReport(text)&&/[？?]|嗎|呢[。\s]*$|幾個|多少|可以.*(?:講|說|告訴)/.test(normalizeCallText(text)))return {intent:'knowledge',tool:'retrieve_knowledge',query:normalizeCallText(text)};
 const draft=reportDraft(history,now);
 if(!draft)return {intent:'knowledge',tool:'retrieve_knowledge',query:normalizeCallText(text),...(confirmsStartup(text)?{report_reply:'目前沒有待儲存的工單。'}:{})};
 if(draft.cancelled)return {intent:'report',tool:'retrieve_knowledge',query:'工單回報流程',report_reply:'本次回報已停止。'};
 if(draft.turns.length===1)return {intent:'report',tool:'retrieve_knowledge',query:'工單回報所需資訊',report_reply:'工單日期、工單或設備編號、維修項目與數量是什麼？'};
 if(draft.turns.length>2&&!confirmsStartup(text)&&!isReport(text)&&!/(?:補充|修正|更新|更換|保養|維修項目|設備編號|數量|備註|\d.*(?:年|月|個)|FAN\s*\d)/i.test(normalizeCallText(text)))return {intent:'knowledge',tool:'retrieve_knowledge',query:normalizeCallText(text)};
 return {intent:'report',tool:'add_work_order',query:'單次追問後新增或補充本次工單'};
}
