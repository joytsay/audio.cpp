import path from 'node:path';
import {parseDocument} from 'htmlparser2';

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
  return (/\.html?$/i.test(filename) ? path.basename(filename) : path.parse(filename).name).trim();
}

export function htmlScenarioText(html, images) {
  const lines = [];
  const parts = [];
  const flush = () => {
    const line = parts.join('').replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
    parts.length = 0;
  };
  const blocks = /^(?:address|article|blockquote|br|dd|div|dl|dt|h[1-6]|hr|li|main|ol|p|pre|section|table|td|th|tr|ul)$/;
  const ignored = /^(?:head|script|style|template|noscript|iframe|svg|canvas)$/;
  const nodes = [...parseDocument(html).children].reverse();
  let section = '';
  while (nodes.length) {
    const node = nodes.pop();
    if (!node) { flush(); continue; }
    if (node.type === 'text') { parts.push(node.data); continue; }
    if (!node.children || ignored.test(node.name) || Object.hasOwn(node.attribs ?? {}, 'hidden')) continue;
    if (node.name === 'img' && images && node.attribs.src) {
      flush();
      section = lines.findLast(line => /^(?:情境|scenario)\s*\d+/i.test(line)) ?? section;
      images.push({src:node.attribs.src, text:(node.attribs.alt || node.attribs.name || '').slice(0,200), section});
    }
    const block = blocks.test(node.name);
    if (block) { flush(); nodes.push(null); }
    for (let index = node.children.length - 1; index >= 0; index--) nodes.push(node.children[index]);
  }
  flush();
  return lines.join('\n');
}

export function scenarioExamples(name, dataset, documents) {
  const fields = [
    [/^(?:派工單號|工單編號|dispatch[ _]number)/i, /^[a-z]{1,6}-\d[a-z0-9_/-]{0,48}$/i, value => `我要查詢${value}`],
    [/^(?:設備型號|型號|model)/i, /^[a-z0-9][a-z0-9 ._/-]{0,63}$/i, value => `我要查詢型號${value}`],
    [/^(?:姓名|中文姓名|name)/i, /^(?:\p{Script=Han}{2,6}|[a-z][a-z .'-]{1,48})$/iu,
      value => /^\p{Script=Han}{3,4}$/u.test(value) ? `我要查詢 ${value}` : `我要查詢姓名${value}`],
    [/^(?:設備序號|機身序號|序號|s\/?n|serial)/i, /^[a-z0-9][a-z0-9._/-]{0,63}$/i, value => `我要查詢 SN ${value}`],
    [/^(?:員工編號|工號|employee[ _](?:number|id))/i, /^[a-z0-9][a-z0-9_-]{0,47}$/i, value => `我要查詢員工編號${value}`],
  ];
  const samples = fields.map(() => new Set());
  for (const table of dataset?.tables ?? []) {
    const columns = fields.map(([header]) => table.headers.filter(column => header.test(column.normalize('NFKC'))));
    for (const {fields: row} of table.records) {
      for (const [index, [, valid, question]] of fields.entries()) {
        if (samples[index].size === 3) continue;
        for (const column of columns[index]) {
          const value = String(row[column] ?? '').trim();
          if (valid.test(value.normalize('NFKC'))) samples[index].add(question(value));
          if (samples[index].size === 3) break;
        }
      }
    }
  }
  const examples = new Set();
  const collected = samples.map(sample => [...sample]);
  for (let index = 0; index < 3 && examples.size < 3; index++) {
    for (const sample of collected) if (sample[index]) examples.add(sample[index]);
  }
  const questions = (dataset?.template ?? []).flatMap(section => section.turns.filter(turn => turn.role === 'caller').map(turn => turn.text));
  for (const raw of [...questions, ...documents.map(document => document.question)]) {
    if (examples.size >= 3) break;
    const question = raw?.replace(/\s+/g, ' ').trim();
    if (question && question.length <= 150 && /[？?]$/.test(question) &&
        !/(?:我要|幫我|請你)(?:回報|新增|刪除|更新|儲存)/.test(question)) examples.add(question);
  }
  return [...new Set([...examples,
    `「${name}」可以查詢什麼？`,
    `請摘要「${name}」的主要內容。`,
    `「${name}」有哪些需要留意的事項？`,
  ])].slice(0, 3);
}

export function dialogueTemplate(text) {
  const sections = [{title:'通話開場', turns:[]}];
  let turn;
  for (const line of text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
    const heading = /^(?:情境|Scenario)\s*(\d+)\s*[:：.、-]?\s*(.+)/i.exec(line);
    if (heading) {
      sections.push({number:Number(heading[1]), title:heading[2], turns:[]});
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
  const html = /\.html?$/i.test(filename);
  const grouped = new Map();
  if (!workbook) grouped.set('', {headers:new Set(), records:[]});
  const dialogue = dialogueTemplate(sources.filter(source => !source.fields && !source.sheet && !source.image).map(source => source.text).join('\n'));
  const template = html && !dialogue.some(section => section.number) ? [] : dialogue;
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
  const tables=[...grouped].filter(([, {headers}]) => !html || headers.size).map(([sheet,{headers,records}])=>({
    name:workbook?`${name}_${sheet}`:name,
    sheet,headers:[...headers],records,
  }));
  if(tables.some(table=>table.name.length>128)){
    throw Object.assign(new Error('A generated n8n table name exceeds 128 characters. Shorten the filename or worksheet name.'),{status:400});
  }
  return {template,tables};
}
