import assert from 'node:assert/strict';
import { once } from 'node:events';
import { appendFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { createDialogueServer, loadDialogue } from '../../../examples/docker/agx-one-container/n8n/sip-dialogue-server.mjs';
import { chooseSimulationSection, simulationGuidance, simulationSections } from '../../../examples/docker/agx-one-container/knowledge/scenario-simulation.mjs';

const source = process.env.IVR_SCENARIO_HTML ||
  join(homedir(), 'Documents/scenarios/情境模擬_20261105.html');
const stamp = new Date().toISOString().replaceAll(':', '-');
const logFile = resolve(process.env.IVR_TEST_LOG_DIR || '.', `${stamp}-log.txt`);
const minimumMatch = 0.8;
const model = 'opening-test-model';
const fixtureId = 'opening-html';
const intents = [
  ['Call Out系統主動通知派工。', 'Can you confirm my dispatch assignment?', 'chat'],
  ['我要回報例行保養，更換兩個風扇。', 'I want to report preventive maintenance. I replaced two fans.', 'report'],
  ['我要回報現場查修，變頻器過載。', 'I want to report onsite troubleshooting for an inverter overload.', 'report'],
  ['請問料號 1756ESMCAP 還有庫存嗎？', 'Is part 1756ESMCAP in stock?', 'retrieval'],
  ['請查詢 PF753 更換風扇的 SOP。', 'What is the PF753 fan replacement procedure?', 'retrieval'],
  ['請幫我轉接工程部。', 'Please connect me to my coworker in Engineering.', 'chat'],
  ['請查詢 PF753 的故障碼 007。', 'What does PF753 fault code 007 mean?', 'retrieval'],
];

const englishPrompts = [
  'For identity verification, what is the name of the person who owns this phone?',
  'What are the last three digits of your employee ID?',
  'What is your direct supervisor’s name?',
  'What would you like to report?',
];

function readReference(html) {
  // The LibreOffice export puts each opening prompt and scenario heading in a paragraph.
  const paragraphs = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(match => match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
  const first = paragraphs.findIndex(text => /^情境\s*1\s*[:：]/u.test(text));
  assert.ok(first > 0, 'Missing scenario headings in the HTML');
  const dispatch = paragraphs.slice(first + 1).find(Boolean)?.match(/^AI\s*[:：]\s*(.+)/u)?.[1];
  assert.ok(dispatch, 'Scenario 1 must begin with an AI dispatch reminder');
  const opening = paragraphs.slice(0, first);
  return {
    dispatch,
    prompts: opening.flatMap(text => /^AI\s*[:：]\s*(.+)/u.exec(text)?.[1] ?? []),
    callers: opening.flatMap(text => /^維修人員\s*[:：]\s*(.+)/u.exec(text)?.[1] ?? []),
    template: paragraphs.slice(first).flatMap(text => {
      const heading = /^情境\s*(\d+)\s*[:：]\s*(.+)/u.exec(text);
      if (!heading) return [];
      const number = Number(heading[1]);
      return [{number, title: heading[2], turns: number === 1 ? [{role: 'assistant', text: dispatch}] : []}];
    }),
  };
}

function similarity(actual, expected) {
  const normalize = text => [...text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')];
  const left = normalize(actual);
  const right = normalize(expected);
  let previous = Array.from({length: right.length + 1}, (_, i) => i);
  for (const [i, char] of left.entries()) {
    const row = [i + 1];
    for (const [j, other] of right.entries()) {
      row.push(Math.min(previous[j + 1] + 1, row[j] + 1, previous[j] + Number(char !== other)));
    }
    previous = row;
  }
  return 1 - previous[right.length] / Math.max(1, left.length, right.length);
}

function log(line) {
  appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`, {mode: 0o600});
}

const trace = [];
const saved = [];
const replyFor = (channel, language) => language === 'en'
  ? `The ${channel} test endpoint received the request.`
  : `${channel} 測試端點已收到請求。`;
let reference, sections, bridge, upstream, bridgeUrl;

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

before(async () => {
  log(`Opening tests · ${source}`);
  console.log(`Interaction log: ${logFile}`);
  reference = readReference(await readFile(source, 'utf8'));
  assert.equal(reference.prompts.length, 5);
  assert.equal(reference.callers.length, 4);
  const files = [{name: basename(source)}];
  sections = simulationSections(files, {template: reference.template});
  assert.deepEqual(sections.map(({number}) => number), [1, 2, 3, 4, 5, 6, 7]);
  const webuiLib = new URL('../src/lib/', import.meta.url);
  const simulationSource = await readFile(new URL('scenario-simulation.ts', webuiLib), 'utf8');
  const simulation = await import('data:text/javascript;base64,' +
    Buffer.from(stripTypeScriptTypes(simulationSource)).toString('base64'));

  // Keep external inference and work-order writes isolated. Route recognition and
  // the opening state machine use the same code as the running SIP service.
  upstream = createServer(async (request, response) => {
    try {
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const body = raw ? JSON.parse(raw) : null;
      let result;
      switch (request.url) {
        case '/v1/ui/demo-settings':
          result = {settings: {dialogue_source: 'n8n', sip_scenario_id: fixtureId}};
          break;
        case '/v1/ui/greetings':
          result = {content: ''};
          break;
        case '/v1/ui/demo-call-log':
          saved.push(body);
          result = {ok: true};
          break;
        case '/scenarios':
          result = {scenarios: [{id: fixtureId, simulation: true, files}]};
          break;
        case '/ivr-simulation': {
          assert.equal(body.id, fixtureId);
          if (body.number) {
            trace.push({channel: 'retrieval', ...body});
            result = {answer: replyFor('retrieval', body.language)};
          } else {
            const section = chooseSimulationSection(sections, body.text);
            trace.push({channel: 'route', text: body.text, number: section?.number});
            result = {scenario: section ? simulationGuidance(section) : null};
          }
          break;
        }
        case '/webhook/ivr-scenario-report':
          trace.push({channel: 'report', ...body});
          result = {scenario_report: true, reply: replyFor('report', body.scenarioReport.language)};
          break;
        case '/models':
          result = {data: [{id: model, loaded: true}]};
          break;
        case '/v1/chat/completions?autoload=true': {
          trace.push({channel: 'chat', ...body});
          const language = /Speak only in English|spoken English line/.test(body.messages[0].content) ? 'en' : 'zh';
          result = {choices: [{message: {content: replyFor('chat', language)}}]};
          break;
        }
        default:
          throw new Error(`Unexpected service call ${request.method} ${request.url}`);
      }
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(500);
      response.end(error.message);
    }
  });
  const backend = await listen(upstream);
  bridge = createDialogueServer({
    dialogue: await loadDialogue(webuiLib.pathname),
    readGreetingCsv: () => '',
    scenarioSimulation: simulation,
    normalizeTranscript: text => text.replaceAll('台積電', '臺積電'),
    saveCallLogs: true,
    audioUrl: backend,
    knowledgeUrl: backend,
    llmUrl: `${backend}/v1`,
    workflowUrl: `${backend}/webhook/ivr-agent`,
    scenarioReportUrl: `${backend}/webhook/ivr-scenario-report`,
  });
  bridgeUrl = await listen(bridge);
});

after(async () => {
  for (const server of [bridge, upstream]) {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
  }
});

async function post(route, body) {
  const response = await fetch(bridgeUrl + route, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const data = await response.text();
  assert.ok(response.ok, data);
  return data;
}

for (const [language, choice, intentColumn] of [['zh', '1', 0], ['en', '2', 1]]) {
  for (const [index, intent] of intents.entries()) {
    const number = index + 1;
    test(`${language} · scenario ${number}`, async t => {
      const started = Date.now();
      const sessionId = `sip-${started}`;
      const channel = number === 1 && language === 'zh' ? 'script' : intent[2];
      const selection = intent[intentColumn];
      const callerLabel = language === 'zh' ? '維修人員' : 'Caller';
      const scores = [];
      trace.length = 0;
      saved.length = 0;
      const expectedLog = [{role: 'Call', text: 'Started'}];
      log(`\n[${language} · scenario ${number} · ${sessionId}] ${sections[index].title}`);

      function show(line) {
        t.diagnostic(line);
        log(line);
      }
      function checkPrompt(reply, expected) {
        show(`AI：${reply}`);
        const score = similarity(reply, expected);
        scores.push(score);
        log(`Expected: ${expected}\nMatch: ${Math.round(score * 100)}%`);
        assert.ok(score >= minimumMatch, `Opening prompt scored ${Math.round(score * 100)}%: ${reply}`);
      }
      async function turn(text) {
        show(`${callerLabel}：${text}`);
        const result = await post('/dialogue', {sessionId, text, model, prompt: '', messages: []});
        const events = result.trim().split('\n').map(line => JSON.parse(line));
        const errors = events.filter(event => event.type === 'error');
        if (errors.length) log(`ERROR: ${JSON.stringify(errors)}`);
        assert.deepEqual(errors, []);
        const replies = events.filter(event => event.type === 'reply');
        assert.equal(replies.length, 1, result);
        const reply = replies[0].reply;
        expectedLog.push({role: 'Caller', text}, {role: 'AI', text: reply});
        return reply;
      }

      show(language === 'zh' ? 'AI語音' : 'AI voice');
      const greeting = JSON.parse(await post('/tts-config', {sessionId, model, welcomeGreeting: true}));
      checkPrompt(greeting.greeting, reference.prompts[0]);
      expectedLog.push({role: 'AI', text: greeting.greeting});
      const expected = language === 'zh' ? reference.prompts.slice(1) : englishPrompts;
      const [name, employeeDigits, supervisor, workOrder] = reference.callers;
      const languageAnswer = number === 1 ? language === 'zh'
        ? '中文，就是，嗯，我要選中文。' : 'I would like English.' : choice;
      if (number === 1) checkPrompt(await turn('中文、英文'), reference.prompts[0]);
      for (const [i, text] of [languageAnswer, name, employeeDigits, supervisor].entries()) {
        const reply = await turn(text);
        if (i === 3) show(language === 'zh' ? '選擇情境' : 'Scenario selection');
        checkPrompt(reply, expected[i]);
      }
      assert.deepEqual(trace, [], 'Scenario selection must wait until the opening is complete');

      if (channel === 'report') {
        const ambiguous = language === 'zh' ? workOrder : 'Work order report';
        const clarification = await turn(ambiguous);
        show(`AI：${clarification}`);
        assert.match(clarification, language === 'zh' ? /例行保養.*現場查修/ : /preventive maintenance.*troubleshooting/i);
        assert.deepEqual(trace, [{channel: 'route', text: ambiguous, number: undefined}]);
        trace.length = 0;
      }

      const reply = await turn(selection);
      show(`AI：${reply}`);
      show(`Selected scenario: ${trace[0]?.number ?? 'none'} · ${trace[1]?.channel ?? 'no downstream call'}`);
      assert.equal(reply, channel === 'script' ? reference.dispatch : replyFor(channel, language));
      assert.equal(trace.length, channel === 'script' ? 1 : 2);
      assert.deepEqual(trace[0], {channel: 'route', text: selection, number});
      const downstream = trace[1];
      if (downstream) assert.equal(downstream.channel, channel);
      if (channel === 'report') {
        assert.deepEqual(downstream.scenarioReport, {number, language});
        assert.equal(downstream.text, selection);
      } else if (channel === 'retrieval') {
        assert.deepEqual({number: downstream.number, language: downstream.language, text: downstream.text},
          {number, language, text: selection});
      } else if (channel === 'chat') {
        const system = downstream.messages[0].content;
        if (number === 1) {
          assert.match(system, /Translate the quoted dispatch reminder.*spoken English line/);
          assert.ok(system.includes(reference.dispatch));
        } else {
          assert.ok(system.includes(language === 'en' ? 'Speak only in English' : 'Speak only in Traditional Chinese'));
        }
        assert.equal(downstream.messages.at(-1).content, selection);
      }
      assert.ok(saved.every(entry => entry.session_id === sessionId && entry.started_at_ms === started));
      assert.deepEqual(saved.flatMap(entry => entry.entries), expectedLog);
      t.diagnostic(`Opening prompt matches: ${scores.map(score => `${Math.round(score * 100)}%`).join(', ')}`);
      log('PASS');
    });
  }
}
