import {confirmsStartup,normalizeCallText,reportDraft} from './conversation.mjs';

const confirms = /^(?:正確|確認|是的|沒錯|對|correct|confirmed|yes|that's right)[。！!.\s]*$/i;
const cancelled = /^(?:(?:請|幫我)\s*)?(?:取消(?:本次)?(?:回報|工單)?|不要(?:儲存|回報)|cancel(?: the report)?)[。！!.\s]*$/i;
const names = {
  zh: { date:'工單日期', equipment:'工單或設備編號', model:'變頻器型號', fault:'故障碼', readings:'現場讀值', maintenance:'維修項目與數量' },
  en: { date:'job date', equipment:'work order or equipment ID', model:'drive model', fault:'fault code', readings:'observed readings', maintenance:'maintenance details and quantities' },
};
const nameplateUnits = [
  ['電壓', 'voltage', 'V|伏特'],
  ['頻率', 'frequency', 'Hz|赫茲'],
  ['功率', 'power', 'kW|HP|千瓦|馬力'],
  ['電流', 'current', 'A|安培'],
  ['轉速', 'speed', 'rpm|rmp|轉(?:\/分|每分鐘)'],
];
const valuePattern = unit => new RegExp(`(?<![a-z0-9.])[+-]?\\d+(?:\\.\\d+)?\\s*(?:${unit})(?![a-z0-9])`, 'gi');
const issue = /查修|故障|過載|异常|異常|現場讀值|fault\s*code|overload|observed readings/i;
const nameplateLabel = /銘牌|铭牌|名板|nameplate/i;
const orderPattern = /(?:工單(?:編號|號碼|號)|work order\s*(?:id|number|no\.?))[：:#是為\s]*([a-z0-9][a-z0-9_/-]*)/i;
const equipmentPattern = /(?:設備(?:編號|號碼|號)|equipment\s*(?:id|number|no\.?))[：:#是為\s]*([a-z0-9][a-z0-9_/-]*)/i;
const modelPattern = /(?:(?:變頻器|变频器)\s*(?:型[號号])?|型[號号]|(?:inverter|drive)\s*(?:model)?)[：:#是為\s]*([a-z0-9]*\d[a-z0-9_-]*)/i;
const faultPattern = /(?:故障[碼码]|異常碼|錯誤碼|fault\s*code|error\s*code)[：:#是為\s]*([a-z0-9][a-z0-9_-]*)/i;
const assetPattern = /\b[A-Z0-9]+(?:[-_/][A-Z0-9]+)+\b/gi;
const normalStartup = text => confirmsStartup(text) ||
  /^(?:(?:correct|confirmed|yes)[,.\s]+)?(?:start[ -]?up(?: test)?|test run)(?: was| is)? (?:normal|passed|successful)[.!\s]*$/i.test(text);

function measurements(raw) {
  return nameplateUnits.map(([, , units]) => [...raw.matchAll(valuePattern(units))].at(-1)?.[0]?.trim());
}

export function scenarioReportProgress(history, number, language, now = new Date()) {
  const en = language === 'en';
  const labels = names[en ? 'en' : 'zh'];
  const ask = fields => en ? `Please provide the ${fields.join(', ')}.` : `請提供${fields.join('、')}。`;
  const review = parts => `${parts.join(en ? '; ' : '，')}${en ? '. Is that correct?' : '。以上是否正確？'}`;
  const clean = history.map(text=>normalizeCallText(text.normalize('NFKC')).trim());
  const draft = reportDraft(history, now, true);
  if (draft.cancelled || clean.some(text => cancelled.test(text))) {
    return {reply:en ? 'The work order report was cancelled.' : '本次工單回報已取消。'};
  }
  if (number === 3) {
    let order = '', equipment = '', model = '', fault = '';
    const readings = new Set(), plate = [];
    let lastChange = -1, confirmation = -1;
    for (const [index, raw] of history.entries()) {
      const text = clean[index];
      if (confirms.test(text)) { confirmation = index; continue; }
      const old = JSON.stringify([order, equipment, model, fault, [...readings], plate]);
      const explicitOrder = text.match(orderPattern)?.[1];
      order = explicitOrder || order;
      const asset = [...text.matchAll(assetPattern)].find(([value])=>
        /[A-Z]/i.test(value)&&/\d/.test(value)&&value!==explicitOrder)?.[0];
      equipment = text.match(equipmentPattern)?.[1] || (issue.test(text) ? asset : '') || equipment || asset || '';
      model = text.match(modelPattern)?.[1] || model;
      fault = text.match(faultPattern)?.[1] || fault;
      const values = measurements(raw);
      const nameplate = nameplateLabel.test(text) || (!issue.test(text) &&
        (values[0] || values[2] || ((order || equipment) && model && fault && readings.size)));
      if (nameplate) {
        for (const [position, value] of values.entries()) if (value) plate[position] = value;
      } else {
        for (const match of raw.matchAll(valuePattern('V|伏特|Hz|赫茲|kW|HP|千瓦|馬力|A|安培|rpm|rmp|轉(?:\\/分|每分鐘)'))) {
          readings.add(match[0].trim());
        }
      }
      if (old !== JSON.stringify([order, equipment, model, fault, [...readings], plate])) lastChange = index;
    }
    const missing = [[draft.date, labels.date], [order || equipment, labels.equipment], [model, labels.model],
      [fault, labels.fault], [readings.size, labels.readings]].filter(([value]) => !value).map(([, label]) => label);
    if (missing.length) return {reply:ask(missing)};
    const missingPlate = nameplateUnits.flatMap((unit, index)=>plate[index]?[]:[unit[en?1:0]]);
    if (missingPlate.length) {
      const summary = review([`${labels.model} ${model}`, `${labels.fault} ${fault}`, `${labels.readings} ${[...readings].join('、')}`]);
      return {reply:summary + (en ? ` Please provide the motor nameplate ${missingPlate.join(', ')}.` : `請提供馬達銘牌的${missingPlate.join('、')}。`)};
    }
    if (confirmation <= lastChange || confirmation !== history.length - 1) {
      return {reply:review(nameplateUnits.map((unit, index)=>`${unit[en?1:0]} ${plate[index]}`))};
    }
    return {draft, order, equipment, details:{
      變頻器型號:model, 故障碼:fault, 現場讀值:[...readings].join('、'),
      馬達銘牌:Object.fromEntries(nameplateUnits.map(([label], index)=>[label,plate[index]])),
    }};
  }

  const latestDetail = clean.findLastIndex(text=>!confirms.test(text)&&!normalStartup(text)&&
    !/^(?:我要|我想)?\s*(?:回報工單|工單回報|情境\s*2|scenario\s*2)[。！!.\s]*$/i.test(text));
  const confirmIndex = clean.findLastIndex(text=>confirms.test(text)||(/^(?:正確|確認|是的|correct|confirmed|yes)[，,。\s]/i.test(text)&&normalStartup(text)));
  const order = draft.fields.工單編號, equipment = draft.fields.設備編號;
  const missing = [[draft.date, labels.date], [order || equipment, labels.equipment], [draft.details, labels.maintenance]]
    .filter(([value])=>!value).map(([, label])=>label);
  if (missing.length) return {reply:ask(missing)};
  if (confirmIndex <= latestDetail) {
    const detail = history[latestDetail];
    return {reply:review([/備註|备注|\b(?:notes?|SN)\b/i.test(detail)?detail:draft.details])};
  }
  const startup = clean.findLastIndex(text=>/起機|試機|(?:啟動|開機).*測試|(?:start[ -]?up|test run)/i.test(text));
  const normal = startup >= 0 && normalStartup(clean[startup]);
  if (!normal || startup <= latestDetail) {
    return {reply:en ? 'Was the startup test normal?' : '請問起機測試是否正常？'};
  }
  return {draft, order, equipment, details:{}, testResult:'正常'};
}
