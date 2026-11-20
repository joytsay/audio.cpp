import {normalizeCallText} from './conversation.mjs';

const flows = {
  1: {
    intent: /派工|派遣|call\s*out|dispatch|assignment/i,
    steps: 'Act as an outbound dispatch reminder. Confirm the assignment using the technician, schedule, site and task supplied in this call. Ask for any missing assignment details. Keep the reminder brief.',
  },
  2: {
    heading: /工單回報|work[ -]order report/i,
    intent: /保養|定期維修|更換|五年一維|強排|間面|maintenance|replac|\bfans?\b/i,
    steps: 'For a preventive-maintenance work order, collect the job date, job or equipment identifiers and maintenance details. Read back each equipment ID with its own work and quantities, then ask for confirmation. If the caller adds notes, read back only the notes and keep each part number, serial, manufacture date and capacitor value correctly paired. Confirm the notes, then ask about the startup test if needed. Close the simulated report after the caller has confirmed the details and a normal startup test. Ask about corrections or abnormal results before closing.',
  },
  3: {
    intent: /查修|故障|過載|告警|跳脫|異常|檢修|fault\s*code|troubleshoot|overload|diagnos/i,
    steps: 'For a troubleshooting work order, capture the job date, job or equipment ID, drive model, fault code and observed readings. First read back the fault and readings for confirmation and request motor nameplate data: voltage, frequency, power, current and speed. A complete nameplate reply can also serve as the caller’s confirmation of the first readback unless they correct it. Read back the supplied nameplate data and ask for confirmation. Close the simulated troubleshooting report only after the caller confirms the nameplate. Preserve the caller’s units and values.',
  },
  4: {
    intent: /庫存|庫存量|現貨|可用量|料件.*(?:剩|還有)|\bstock\b|inventory|availability/i,
    steps: 'Ask for the part number if needed. For an exact part-number match in a reference Q/A, report the example location and available quantity, or the example lead time if out of stock. Attribute stock and lead times to the uploaded example. For unlisted parts, say the reference does not contain that part. Keep multiple part queries separate.',
    retrieval: true,
  },
  5: {
    intent: /\bSOP\b|操作流程|更換步驟|維修步驟|怎麼(?:更換|拆)|如何(?:更換|拆)|procedure|how (?:to|do I) replac/i,
    steps: 'Confirm the equipment model and procedure requested. Summarize only steps from a reference Q/A covering the exact model and task. Treat an incomplete excerpt as incomplete. Ask for the relevant document when the reference does not cover the request.',
    retrieval: true,
  },
  6: {
    intent: /打電話|撥號|轉接|聯絡.*同事|call\s+(?:a\s+)?(?:colleague|coworker)|transfer|connect me/i,
    steps: 'Identify the requested colleague and department from the call. In this simulated transfer flow, ask for the full employee number and then ask for the direct supervisor name. Keep the two questions on separate turns. Once both are supplied, acknowledge the requested recipient as a simulated transfer. Do not claim an actual transfer or verified identity.',
  },
  7: {
    intent: /故障碼|異常碼|錯誤碼|\bfault\s*code\b|\berror\s*code\b/i,
    steps: 'Ask for the exact drive model and fault code if either is missing. For an exact model-and-code match, explain the reference meaning and summarize its troubleshooting suggestion. Treat leading zeroes as significant. If the exact model and code are missing from the reference, say so.',
    retrieval: true,
  },
};

export function simulationSections(files, dataset) {
  if (files.length !== 1 || !/\.html?$/i.test(files[0].name)) return [];
  return dataset?.template.filter(section => {
    const flow = flows[section.number];
    return (flow?.heading ?? flow?.intent)?.test(section.title);
  }) ?? [];
}

export function chooseSimulationSection(sections, raw) {
  const text = normalizeCallText(raw.normalize('NFKC')).trim();
  const explicit = text.match(/^(?:請|我要|我想)?\s*(?:(?:啟動|選擇|進入)\s*)?(?:情境|scenario)\s*([1-8一二三四五六七八])(?=$|[^\d])/i);
  if (explicit) {
    const number = Number(explicit[1]) || '一二三四五六七八'.indexOf(explicit[1]) + 1;
    return sections.find(section => section.number === number);
  }
  const named = sections.find(section => text.toLowerCase().includes(section.title.toLowerCase()) && section.number !== 2);
  if (named) return named;
  const report = /回報|report\b/i.test(text) && !/查詢|\b(?:lookup|look up)\b/i.test(text);
  const candidates = report || (flows[3].intent.test(text) && !/查詢|查一下|意思|是什麼|\b(?:lookup|look up|what does)\b/i.test(text))
    ? [3, 2, 7, 4, 5, 6, 1] : [6, 4, 5, 7, 1, 3, 2];
  for (const number of candidates) {
    if (!flows[number].intent.test(text)) continue;
    const section = sections.find(item => item.number === number);
    if (section) return section;
  }
}

export function simulationGuidance(section) {
  const flow = flows[section.number];
  return {
    number: section.number,
    title: section.title,
    steps: flow.steps,
    ...(flow.retrieval ? {retrieval:true} : {}),
  };
}
