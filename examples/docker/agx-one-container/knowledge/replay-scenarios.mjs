// Live check: replay the uploaded HTML call script against the running IVR
// engine and the real model. Each 情境 section gets its own call: the opening
// is answered with the script's opening caller lines, then the section's own
// caller lines are spoken in order.
//
//   docker exec ivr-knowledge node /app/replay-scenarios.mjs        # all sections
//   docker exec ivr-knowledge node /app/replay-scenarios.mjs 2 3    # selected
//
// KNOWLEDGE_URL overrides http://127.0.0.1:8085.
const base = (process.env.KNOWLEDGE_URL || 'http://127.0.0.1:8085').replace(/\/$/, '');
const only = process.argv.slice(2).map(Number);

async function request(route, body) {
  const started = Date.now();
  const response = await fetch(base + route, body === undefined ? {} : {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${route}: ${result.error ?? response.status}`);
  return {...result, ms: Date.now() - started};
}

const {scenarios} = await request('/scenarios');
const selected = scenarios.filter(item => item.simulation).at(-1);
if (!selected) throw new Error('No HTML call script has been uploaded.');
const record = await request(`/scenario-imports/${selected.id}`);
const template = record.dataset.template;
const openingAnswers = ['1', ...(template.find(section => !section.number)?.turns ?? [])
  .filter(turn => turn.role === 'caller').map(turn => turn.text)].slice(0, -1);
console.log(`Script: ${selected.name}\nOpening answers: ${openingAnswers.join(' / ')}`);

let failures = 0;
for (const section of template.filter(item => item.number && (!only.length || only.includes(item.number)))) {
  const sessionId = `replay-${section.number}-${Date.now()}`;
  const callerLines = section.turns.filter(turn => turn.role === 'caller').map(turn => turn.text.replace(/\s+/g, ' ').trim());
  // An outbound section is selected by its title, then the callee answers.
  const lines = section.turns[0]?.role === 'assistant' ? [section.title, ...callerLines] : callerLines;
  console.log(`\n===== 情境 ${section.number}：${section.title}`);
  await request('/ivr', {sessionId, start: true, scenarioId: selected.id});
  for (const text of openingAnswers) await request('/ivr', {sessionId, text});
  let last;
  for (const text of lines) {
    last = await request('/ivr', {sessionId, text});
    console.log(`Caller: ${text}\nAI:     ${last.reply}   [${last.scenario ? '#' + last.scenario.number : last.stage} ${last.status} ${last.ms}ms]`);
    if (last.work_order) {
      const {records} = await request('/ivr', {sessionId, records: true});
      for (const row of records) console.log(`        work order ${row.order_id}: ${JSON.stringify(JSON.parse(row.results).fields)}`);
    }
  }
  const ok = last?.scenario?.number === section.number && last.status === 'done';
  if (!ok) failures++;
  console.log(ok ? '✔ completed in the right scenario' : '✘ did not complete this scenario');
  await request('/ivr', {sessionId, end: true});
}
console.log(failures ? `\n${failures} scenario(s) did not complete` : '\nall scenarios completed');
process.exitCode = failures ? 1 : 0;
