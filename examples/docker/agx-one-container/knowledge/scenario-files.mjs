import path from 'node:path';

export function uniqueHeaders(labels) {
  const used = new Set();
  return labels.map((label, index) => {
    const original = String(label || `欄位${index + 1}`).trim() || `欄位${index + 1}`;
    let header = original, suffix = 1;
    while (used.has(header)) header = `${original} (${++suffix})`;
    used.add(header);
    return header;
  });
}

export function scenarioFileName(filename) {
  return path.parse(filename).name.trim();
}

export function dialogueTemplate(text) {
  const sections = [{title:'通話開場', turns:[]}];
  let turn;
  for (const line of text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
    const heading = /^(?:情境|Scenario)\s*\d+\s*[:：.、-]?\s*(.+)/i.exec(line);
    if (heading) {
      sections.push({title:heading[1], turns:[]});
      turn = undefined;
      continue;
    }
    const speaker = /^(AI|助理|GEOVISION|A|答案|回答|Q|問題|維修人員|客戶|使用者|YOU)\s*[:：]\s*(.*)$/i.exec(line);
    if (speaker) {
      const role = /^(AI|助理|GEOVISION|A|答案|回答)$/i.test(speaker[1]) ? 'assistant' : 'caller';
      turn = {role, text:speaker[2]};
      sections.at(-1).turns.push(turn);
    } else if (turn && !/^(?:選擇情境|進入情境|參考圖表)$/.test(line)) {
      turn.text = [turn.text, line].filter(Boolean).join('\n');
    }
  }
  const populated = sections.filter(section => section.turns.length);
  const roles = new Set(populated.flatMap(section => section.turns.map(turn => turn.role)));
  return roles.size === 2 ? populated : [];
}

export function fileDataset(filename, sources) {
  const name = scenarioFileName(filename);
  const workbook = /\.xlsx$/i.test(filename);
  const grouped = new Map();
  if (!workbook) grouped.set('', {headers:new Set(), records:[]});
  const template = dialogueTemplate(sources.filter(source => !source.fields && !source.sheet && !source.image).map(source => source.text).join('\n'));
  for (const source of sources) {
    const sheet = workbook ? source.sheet : '';
    if (!grouped.has(sheet)) grouped.set(sheet, {headers:new Set(), records:[]});
    const table = grouped.get(sheet);
    if (source.headers) for (const header of source.headers) table.headers.add(header);
    if (source.fields) {
      table.records.push({fields:source.fields, row:source.row, section:source.section || '', extraction:source.extraction});
    } else if (source.text.trim() && !(template.length && !source.image)) {
      table.headers.add('content');
      for (const content of source.text.match(/[\s\S]{1,1400}/gu) || []) {
        table.records.push({fields:{content}, row:source.row, section:source.image || '', extraction:source.extraction});
      }
    }
  }
  const tables=[...grouped].map(([sheet,{headers,records}])=>({
    name:workbook?`${name}_${sheet}`:name,
    sheet,headers:[...headers],records,
  }));
  if(tables.some(table=>table.name.length>128)){
    throw Object.assign(new Error('A generated n8n table name exceeds 128 characters. Shorten the filename or worksheet name.'),{status:400});
  }
  return {template,tables};
}
