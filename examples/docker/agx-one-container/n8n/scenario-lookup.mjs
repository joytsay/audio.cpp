// This function runs inside the generated n8n Code node.
export function lookupScenario(input,tables,template,source) {
  const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/臺/g,'台').trim();
  const words = text => text.match(/[a-z0-9]+(?:[-_./][a-z0-9]+)*/g) || [];
  const tokens = text => {
    const normalized = normalize(text);
    const han = normalized.match(/\p{Script=Han}+/gu) || [];
    return [...new Set([...words(normalized),...han.flatMap(group=>Array.from(group.slice(1),(_,i)=>group.slice(i,i+2)))])];
  };
  const query = normalize(input.query).slice(0,1000);
  const reference = normalize(input.reference);
  const lookup = input.lookup;
  const term = normalize(lookup?.term);
  const nameQuery = query.replace(/^(?:(?:我(?:想要|想|要)\s*)?(?:請\s*)?(?:幫我\s*)?(?:查詢|查找|查一下|查|找出|找)\s*[:：]?\s*)?(?:姓名\s*)?/u,'').replace(/[。?]+$/,'').trim();
  const chineseNameQuery = /^\p{Script=Han}{2,4}$/u.test(nameQuery);
  const englishNameQuery = nameQuery.length<=60&&/^[a-z][a-z.'’\-]*(?:\s+[a-z][a-z.'’\-]*)*$/.test(nameQuery);
  const nameSearch = chineseNameQuery || englishNameQuery;
  const customer = normalize(lookup?.customer);
  const codeTerm = /^[a-z0-9_/-]+$/i.test(term);
  const siteHeader = /廠區|廠別|廠名|據點|地點|\b(?:site|plant|fab|facility|location)\b/i;
  const nameHeader = /^(?:姓名|中文姓名|中文名|聯絡人|(?:full |employee |chinese )?name)$/i;
  const englishHeader = /^(?:英文姓名|英文名|english name)$/i;
  const englishNameKey = value => normalize(value).replace(/\s*\([^()]*\)$/,'').replace(/’/g,"'").replace(/\s+/g,' ');
  const englishNameMatch = (value, search) => {
    const name = englishNameKey(value), key = englishNameKey(search);
    if(!key)return 0;
    if(name===key)return 2;
    return /^[a-z]{2,}$/.test(key)&&name.split(' ').includes(key)?1:0;
  };
  const extensionHeader = /分[機机]|^ext\.?$|\bextension\b/i;
  const departmentHeader = /^(?:部門(?:名稱|\s*\/\s*團隊)?|單位|團隊|department(?: name)?|team)$/i;
  const titleHeader = /^(?:職稱|職務|職位|job title|title)$/i;
  const labelOf = header => normalize(header).replace(/[_-]/g,' ').replace(/ \(\d+\)$/,'');
  const directoryReply = fields => {
    const entries = Object.entries(fields).map(([header,value])=>[labelOf(header),String(value??'').replace(/\s+/g,' ').trim()]);
    const field = pattern => entries.find(([header,value])=>value&&pattern.test(header))?.[1];
    const name = field(nameHeader);
    if(!name||!entries.some(([header])=>extensionHeader.test(header)||departmentHeader.test(header)))return;
    const phone = field(extensionHeader);
    const extension = phone?.match(/(?:分[機机]|#|\bext\.?)\s*[:：]?\s*(\d{1,6})\b/i)?.[1]||
      (phone&&/^\d{1,6}(?:\s*[,/、]\s*\d{1,6})*$/.test(phone)?phone:'');
    const details = [[extension,'分機'],[field(englishHeader),'英文名'],[field(departmentHeader),'部門'],[field(titleHeader),'職稱']];
    return [name,...details.filter(([value])=>value).map(([value,label])=>`${label} ${value}`)].join('，')+'。';
  };
  const customerHeader = /客戶|公司名稱|\bcustomer\b|^company(?:[ _]name)?$/i;
  const employeeHeader = /工[號号]|員編|員工(?:編號|代碼|id|號碼)|员工(?:编号|編號|id)|\bemployee\s*(?:id|no\.?|number|code)\b/i;
  const modelHeader = /型[號号]|\bmodel(?:\s+(?:number|no\.?|id))?\b/i;
  const serialHeader = /序[號号]|序列(?:[號号]|編號)|機號|^(?:s\s*\/?\s*n|serial(?:[ _-]*(?:number|no\.?))?)(?:\b|$)/i;
  const terms = tokens(query);
  const requestedSheet = normalize(lookup?.sheet || input.sheet);
  const relevant = tables.filter(table=>!requestedSheet || [normalize(table.sheet),normalize(table.name)].includes(requestedSheet));
  const named = relevant.filter(table=>table.sheet && query.includes(normalize(table.sheet)));
  const selected = named.length ? named : relevant;
  const records = selected.flatMap(table=>table.rows.filter(row=>row.id!=null).map(row=>{
    const fields = Object.fromEntries(table.columns.map(({header,id})=>[header,row[id]??'']));
    const values = Object.values(fields).map(normalize).filter(Boolean);
    const content = values.join(' ');
    let structuredScore=0;
    if(lookup){
      let customerMatched=false;
      for(const [header,raw] of Object.entries(fields)){
        const value=normalize(raw);
        const label=labelOf(header);
        const site=siteHeader.test(label),person=nameHeader.test(label)||englishHeader.test(label);
        if(customer&&customerHeader.test(label)&&(value===customer||value.startsWith(customer)))customerMatched=true;
        if((lookup.kind==='site'||lookup.kind==='customer_site')&&!site)continue;
        if(lookup.kind==='person'&&!person)continue;
        if(lookup.kind==='employee'&&!employeeHeader.test(label))continue;
        if(lookup.kind==='model'&&!modelHeader.test(label))continue;
        if(lookup.kind==='serial'){
          const serialField=serialHeader.test(label);
          const labelled=[...value.matchAll(/(?:\bs\s*\/?\s*n|序[號号]|序列[號号]|\bserial(?:\s+number)?)\s*[:#]?\s*([a-z0-9][a-z0-9._/-]*)/gi)];
          if(labelled.some(match=>match[1]===term))structuredScore=Math.max(structuredScore,serialField?4:1);
          if(!serialField)continue;
        }
        const englishMatch=englishHeader.test(label)&&/^[a-z]/.test(term)?englishNameMatch(value,term):0;
        const exact=value===term||englishMatch===2;
        const separated=value.split(/[\s,、;，；]+/u).includes(term);
        const code=codeTerm&&words(value).includes(term);
        if(exact||englishMatch||separated||code){
          structuredScore=Math.max(structuredScore,(exact?4:1)+(person?12:site?8:0));
        }
      }
      if(lookup.kind==='customer_site'){
        if(!customerMatched)structuredScore=0;
        else if(structuredScore&&normalize(table.sheet)==='客戶設備')structuredScore+=16;
      }
    }
    const directory = !reference && (lookup ? ['person','employee','keyword'].includes(lookup.kind) : nameSearch)
      ? directoryReply(fields) : undefined;
    const nameScore = directory && nameSearch ? Object.entries(fields).reduce((best,[header,value])=>{
      const label = labelOf(header);
      if(chineseNameQuery&&nameHeader.test(label)&&normalize(value)===nameQuery)return 2;
      return englishNameQuery&&englishHeader.test(label)?Math.max(best,englishNameMatch(value,nameQuery)):best;
    },0) : 0;
    const score = reference
      ? (values.includes(reference)?4:tokens(content).includes(reference)?1:0)
      : lookup?(lookup.fallback&&!directory?0:structuredScore)
        : nameScore?100+nameScore:directory&&chineseNameQuery?0:terms.reduce((sum,word)=>sum+(values.includes(word)?4:content.includes(word)?1:0),0);
    return {table:table.name,sheet:table.sheet,fields,score,nameScore,...(directory&&score>0?{directory_reply:directory}:{}),...((reference||lookup)&&table.ocr?{ocr:true}:{})};
  })).sort((a,b)=>b.score-a.score);
  const bestName = !lookup&&!reference&&records.reduce((best,record)=>Math.max(best,record.nameScore),0);
  const matching = bestName
    ? records.filter(record=>record.nameScore===bestName)
    : query||reference||lookup ? records.filter(record=>record.score>0) : records;
  const scenarioNumber = Number(query.match(/^(?:情境|scenario)\s*(\d+)(?=$|[^\d])/i)?.[1]);
  const exactScenario = template.find(section=>section.number===scenarioNumber);
  const ranked = template.filter(section=>section.title!=='通話開場').map(section=>{
    const title = normalize(section.title);
    const caller = normalize(section.turns.filter(turn=>turn.role==='caller').map(turn=>turn.text).join(' '));
    const score = exactScenario
      ? Number(section===exactScenario)
      : terms.reduce((sum,term)=>sum+(title.includes(term)?3:caller.includes(term)?1:0),0);
    return {section,score};
  }).sort((a,b)=>b.score-a.score);
  return {
    source,
    tables:tables.map(({name,sheet,columns})=>({name,sheet,headers:columns.map(({header})=>header)})),
    matched_rows:matching.length,
    records:matching.slice(0,12).map(({score,nameScore,...record})=>record),
    ...(selected.some(table=>table.ocr)?{ocr_notice:'資料表包含圖片 OCR 結果，請核對原始圖片的代碼及數值。'}:{}),
    ...(template.length?{voice_template:{
      opening:template.find(section=>section.title==='通話開場')?.turns,
      available_scenarios:template.map(section=>section.title),
      scenarios:ranked.filter(match=>match.score>0).slice(0,2).map(match=>match.section),
      instructions:'以範例的流程與提問方式引導通話。身分、日期、數量與結果一律以本通話和實際工具結果為準。只有實際操作成功後才回覆已完成。',
    }}:{}),
  };
}
