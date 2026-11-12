const item=$input.first().json,context=$('Prepare agent context').first().json;
const steps=item.intermediateSteps||[];
const tools=[context.executed_tool||'retrieve_knowledge',...steps.map(step=>step.action?.tool).filter(name=>typeof name==='string')];
const saved=context.saved||steps.filter(s=>/add_work_order$/.test(s.action?.tool||'')).flatMap(s=>payloads(s.observation)).find(p=>p.persisted===true&&p.work_order?.id);
let reply;
if(saved)reply=`工單 ${saved.work_order.id} ${saved.updated?'已補充':'已新增'}。`;
else if(context.facts.selection){
 const facts=context.facts,rows=facts.work_orders;
 const label={newest:'最新',oldest:'最舊',all:'查到的'}[facts.selection]||'';
 const scope=facts.period?facts.period.slice(0,4)+'年'+Number(facts.period.slice(5))+'月':'';
 if(!rows.length&&scope)reply=`${scope}沒有工單記錄。`;
 else if(!rows.length)reply=facts.undated_count>0?`${facts.undated_count} 筆工單日期未完整，無法判定${label}工單。`:`沒有查到${label}工單的有效記錄。`;
 else{
  const summaries=rows.slice(0,3).map(({fields:f})=>`${f['派工單號']}（${f['派工日期']||'日期未完整'}）`);
  reply=`${scope}${label}工單${rows.length===1?'為':'共 '+rows.length+' 筆：'}${rows.length===1?' ':''}${summaries.join('、')}${rows.length>3?'，其餘 '+(rows.length-3)+' 筆可再查詢':''}。`;
  if(facts.undated_count>0&&facts.selection!=='all')reply+=`另有 ${facts.undated_count} 筆日期未完整，未列入排序。`;
 }
}else if(context.report_reply){
 reply=context.report_reply;
}else{
 if(typeof item.output!=='string'||!item.output.trim())throw new Error('AI Agent returned an empty reply');
 reply=item.output.trim().replace(/^(?:AI|助理|GEOVISION)[：:]\s*/i,'').split(/\n|【|---/)[0].trim();
 // One conversational line, never a repeated essay, markdown or chain of thought.
 reply=reply.replace(/[😀-🙏🌀-🫿]/gu,'').trim();
 const first=reply.match(/^.*?[。？！!?](?:[」”])?/u)?.[0];
 if(first)reply=first;
 if(reply.length>200)reply='請告訴我這一輪要查詢或確認的重點？';
 if(/已(?:新增|儲存|建立|輸入完成|完成)|新增成功|保存成功|完成回報|回報完成|工單完成/.test(reply))reply='工單尚未儲存。';
 if(!reply)throw new Error('AI Agent returned an empty spoken reply');
}
return [{json:{reply:reply.replace(/\s*\n\s*/g,' '),tools:[...new Set(tools)]}}];
