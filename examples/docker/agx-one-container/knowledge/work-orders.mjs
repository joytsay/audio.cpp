import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isReport,confirmsStartup,reportDate,reportDraft,callDecision} from './conversation.mjs';
export {isReport,confirmsStartup,reportDate} from './conversation.mjs';
const failure=(message,status=400)=>Object.assign(new Error(message),{status});

// New records are written by the native n8n Data Table node. This service only
// binds real caller transcripts, prepares rows, and reads the old JSON backup.
export function createWorkOrderStore({root=process.env.KNOWLEDGE_DATA_ROOT||'/data',now=()=>new Date()}={}){
 const contexts=new Map();
 async function list(){try{const data=JSON.parse(await fs.readFile(path.join(root,'work-orders.json'),'utf8'));if(!Array.isArray(data))throw Error('Invalid legacy work-order store');return data;}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 return {
  list,
  register({sessionId,text,user_transcripts=[]}){
   if(typeof sessionId!=='string'||!sessionId.trim()||sessionId.length>200||typeof text!=='string'||!text.trim()||text.length>20000||!Array.isArray(user_transcripts)||user_transcripts.length>100||user_transcripts.some(t=>typeof t!=='string'||t.length>20000))throw failure('Invalid call transcript');
   const history=[...(user_transcripts.length?user_transcripts:contexts.get(sessionId)?.history??[])];if(history.at(-1)!==text)history.push(text);
   for(const [key,value]of contexts)if(Date.now()-value.seen>3600000)contexts.delete(key);
   if(!contexts.has(sessionId)&&contexts.size>=128)contexts.delete(contexts.keys().next().value);
   contexts.set(sessionId,{history:history.slice(-100),seen:Date.now()});
   return {sessionId,registered:true,...callDecision(history,now())};
  },
  async prepare(sessionId){
   const context=contexts.get(sessionId);
   if(!context||Date.now()-context.seen>3600000)throw failure('找不到本通話的原始回報。');
   const {history}=context,draft=reportDraft(history);
   if(!draft)throw failure('尚未開始工單回報。');
   if(draft.cancelled)throw failure('本次工單回報已取消。');
   if(callDecision(history,now()).tool!=='add_work_order')throw failure('尚未收到單次追問後的回覆。');
   const rawKey=JSON.stringify([sessionId,history.slice(0,draft.start).filter(isReport).length,draft.turns[0]]);
   const report_key=createHash('sha256').update(rawKey).digest('hex');
   const legacy=(await list()).find(r=>r.reportKey===rawKey||r.reportKeys?.includes(rawKey));
   const order_id=legacy?.id??`GV-${report_key.slice(0,12).toUpperCase()}`;
   const lastTest=[...draft.turns].reverse().find(t=>/測試|测试|試機|起機/.test(t));
   const test_result=lastTest&&confirmsStartup(lastTest)?'正常':lastTest&&/不正常|異常|异常|失敗|失败/.test(lastTest)?'異常':'';
   return {
    order_id,report_key,session_id:sessionId,dispatch_date:draft.date||'',reference_number:draft.fields.工單編號||'',
    title:draft.fields.工單名稱||'',equipment_number:draft.fields.設備編號||'',maintenance_items:draft.fields.維修項目||(/維修|更換|保養|修理/.test(draft.details)?draft.details:''),
    quantity:draft.fields.數量||'',notes:draft.turns.filter(t=>/備註|备注/.test(t)).join('\n'),test_result,
    transcripts:JSON.stringify(draft.turns),
   };
  }
 };
}
