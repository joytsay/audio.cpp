function tableRecord(row){
 const value=name=>String(row[name]??'');
 let transcripts=[];try{transcripts=JSON.parse(row.transcripts||'[]');if(!Array.isArray(transcripts))transcripts=[];}catch{transcripts=[];}
 const id=value('order_id')||`DT-${row.id}`;
 return {id,source:'n8n Data Table / work_orders',sessionId:value('session_id'),reportKey:value('report_key'),createdAt:row.createdAt,updatedAt:row.updatedAt,transcripts,fields:{派工單號:id,派工日期:value('dispatch_date'),工單編號:value('reference_number'),工單名稱:value('title'),設備編號:value('equipment_number'),維修內容:value('maintenance_items'),維修項目:value('maintenance_items'),數量:value('quantity'),備註:value('notes'),起機測試:value('test_result')}};
}
