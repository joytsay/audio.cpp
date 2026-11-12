// Questions are synthesized; answers contain source facts or source-grounded
// conversation guidance. No generated dates, people, IDs, inventory or values.
const pairsForScenario2=[
 ['我要回報維修工單，應該先說什麼？','請提供工單日期、工單名稱、設備編號、維修項目及各項數量。'],
 ['收到維修內容後，你會怎麼確認？','簡短複誦本輪設備與維修重點，再問「以上是否正確？」；不得先宣稱工單已完成。'],
 ['同一工單有多台設備，維修數量可以合併嗎？','各設備的維修項目與數量要分別保留，不能合併或互換。'],
 ['我要補充零件備註，需要哪些資料？','請提供料號、SN、製造日期與電容值，並保留每個 SN 對應的日期及數值。'],
 ['兩個零件的料號相同，SN、日期與電容值怎麼記錄？','同料號可以合併說明筆數，但每個 SN 的製造日期與電容值必須各自配對。'],
 ['補充備註後要重講全部維修內容嗎？','只確認本輪新增的備註，不必重複整份工單。'],
 ['什麼時候才可以完成工單回報？','確認維修內容與備註，並確認起機測試正常後，才完成本次工單；只有新增工具回報儲存成功，才能說已儲存。'],
 ['這次回報不是文件範例中的設備，可以套用範例資料嗎？','不可以；情境 2 只示範回報、備註與起機確認的順序，工單名稱、設備、數量及備註都依本通話原話。'],
];
const pdfReviewedHash='da67021249933c1f98703bb36e0e2da555899abc189dd78a2ccc5a50c2254690';
export function qaDocument(document,question,answer,metadata={}){
 const {text,...source}=document;
 const label=document.kind==='scenario_examples'?'情境示範，非實際工單':document.extraction==='ocr'?'紙本原件；手寫代碼與數值需核對':'來源記錄';
 return {...source,...metadata,question,answer,format:'qa',text:`Q: ${question}\nA: ${answer}\n來源：${document.source}${document.sheet?'／'+document.sheet:''}${metadata.row?'／列 '+metadata.row:''}（${label}）`};
}
export function workbookQa(document,rows){
 const chunks=[];
 for(const row of rows){
  const entries=Object.entries(row.fields).filter(([,value])=>value);
  if(!entries.length)continue;
  const key=entries.find(([name])=>/派工單號|姓名|型號/.test(name))??entries[0];
  const subject=`${key[0]} ${key[1]}`;
  const answer=entries.map(([name,value])=>`${name}：${value}`).join('；')+'。';
  chunks.push(qaDocument(document,`請查詢${subject}的${document.sheet}資料。`,answer,{row:row.row}));
  for(const [field,value]of entries.filter(([name])=>/日期|負責人|SN|MFD|電話|主管|派工項目/.test(name)))
   chunks.push(qaDocument(document,`${subject}的${field}是什麼？`,`${field}：${value}。`,{row:row.row}));
 }
 if(!chunks.length)chunks.push(qaDocument(document,`${document.sheet}有資料嗎？`,'此資料表目前沒有記錄。'));
 return chunks;
}
export function sourceQa(document){
 if(document.kind==='scenario_examples'){
  if(!/情境\s*2[：:]\s*工單回報/.test(document.text))throw Error('Scenario 2 is missing from the source DOCX');
  const chunks=pairsForScenario2.map(([q,a])=>qaDocument(document,q,a,{section:'情境 2：工單回報'}));
  // Retain other source conversations as explicitly labelled examples. Scenario
  // 2 contributes procedural guidance only, never memorized sample IDs/SNs.
  for(const match of document.text.matchAll(/情境\s*([1-8])[：:]\s*([^\n]+)([\s\S]*?)(?=情境\s*[1-8][：:]|$)/g)){
   const [,number,title,body]=match;if(number==='2')continue;
   let question='',answer='',role='';
   const flush=()=>{if(question&&answer)chunks.push(qaDocument(document,`文件情境 ${number} 的示範：${question}`,`文件示例：${answer}`,{section:`情境 ${number}：${title.trim()}`}));};
   for(const raw of body.split('\n')){
    const line=raw.trim();if(!line)continue;
    const caller=line.match(/^(?:維修人員|客戶)[：:]\s*(.*)/);
    const assistant=line.match(/^AI[：:]\s*(.*)/);
    if(caller){flush();question=caller[1];answer='';role='caller';}
    else if(assistant){answer+=(answer?' ':'')+assistant[1];role='assistant';}
    else if(role==='caller')question+=' '+line;
    else if(role==='assistant')answer+=' '+line;
   }
   flush();
  }
  return chunks;
 }
 if(document.kind==='rules')return []; // Prompt examples are never indexed as facts.
 const chunks=[];
 if(document.sha256===pdfReviewedHash){
  // Visually verified against page 1. Do not substitute the DOCX sample's
  // EF equipment code for the handwritten PDF's EA code or infer unclear units.
  for(const [q,a]of [
   ['紙本維修工單的單號是什麼？','紙本第 1 頁的工單號為 YCS-16860。'],
   ['紙本 YCS-16860 的維修日期是什麼？','紙本第 1 頁填寫民國 115 年 6 月 2 日，即 2026-06-02；這是紙本維修日期，不能取代 XLSX 的派工日期。'],
   ['紙本工單的備註要記錄哪些欄位？','備註欄分別記錄零件料號、SN、製造日期與電容值；手寫值及單位須核對原件。'],
   ['紙本工單與 XLSX 的日期不同時，用哪個查最新派工？','查詢最新或最舊派工以 XLSX 派工表的有效派工日期排序；紙本上的日期是另一份來源的維修日期。'],
  ])chunks.push(qaDocument(document,q,a,{page:1,review:'visually_verified'}));
 }
 // Preserve extractable source content as Q/A excerpts. Unknown handwriting is
 // explicitly OCR, never synthesized into confident equipment/serial numbers.
 const paragraphs=document.text.split(/\n\s*\n/).filter(t=>t.trim());
 for(const [index,text]of paragraphs.entries()){
  for(let offset=0;offset<text.length;offset+=1600){
   chunks.push(qaDocument(document,`這份紙本工單第 ${index+1} 段記載什麼內容？`,`${document.extraction==='ocr'?'以下為 OCR 摘錄，手寫代碼與數值需核對原件：':''}${text.slice(offset,offset+1600).trim()}`,{excerpt:index+1}));
  }
 }
 return chunks;
}
