const idleTimeoutMs = 60 * 60 * 1000;
const maxCalls = 256;
// Keep the report history below the n8n workflow's 100-message input limit.
const maxHistory = 98;

export function createSipScenarioCalls({simulation, fetchImpl = fetch, knowledgeUrl, normalizeReply = text => text}) {
  const calls = new Map();
  const knowledge = knowledgeUrl.replace(/\/+$/, '');

  async function request(path, signal, body) {
    const response = await fetchImpl(knowledge + path, body === undefined
      ? {signal, cache: 'no-store'}
      : {method: 'POST', signal, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    if (!response.ok) throw new Error(`SIP scenario request failed (${response.status})`);
    return response.json();
  }

  function current(sessionId) {
    const entry = calls.get(sessionId);
    if (!entry) return undefined;
    calls.delete(sessionId);
    const now = Date.now();
    if (now - entry.lastSeen > idleTimeoutMs) return undefined;
    entry.lastSeen = now;
    calls.set(sessionId, entry);
    return entry;
  }

  async function start(sessionId, savedId, signal) {
    if (!simulation || !sessionId) return '';
    if (savedId === '') {
      calls.delete(sessionId);
      return '';
    }
    const existing = current(sessionId);
    if (existing) return existing.call.step === 0 && !existing.history.length
      ? simulation.simulationOpeningPrompt(existing.call) : '';
    const {scenarios} = await request('/scenarios', signal);
    const available = scenarios.filter(scenario => scenario.simulation &&
      scenario.files?.some(file => /\.html?$/i.test(file.name)));
    // The knowledge service returns the scenarios oldest first.
    const selected = savedId === undefined
      ? available.at(-1)
      : available.find(scenario => scenario.id === savedId);
    if (!selected) return '';
    if (!current(sessionId)) {
      calls.set(sessionId, {
        call: simulation.createSimulation(selected.id, selected.opening), history: [], lastSeen: Date.now(),
      });
      if (calls.size > maxCalls) calls.delete(calls.keys().next().value);
    }
    return simulation.simulationOpeningPrompt(calls.get(sessionId).call);
  }

  async function turn({sessionId, text, model, signal, report, complete}) {
    const entry = current(sessionId);
    if (!entry) return undefined;
    const {call, history} = entry;
    const opening = simulation.advanceSimulationOpening(call, text);
    if (opening !== null) return normalizeReply(opening);
    if (call.workOrderId) return normalizeReply(call.language === 'en'
      ? `Work order ${call.workOrderId} is saved.`
      : `工單 ${call.workOrderId} 已儲存。`);

    const caller = {role: 'user', content: text};
    const messages = [...history, caller];
    const scenario = call.scenario ?? (await request('/ivr-simulation', signal, {
      id: call.id, text, ...(call.sourceOpening ? {language: call.language} : {}),
    })).scenario;
    const dispatchReminder = !call.scenario && call.language === 'zh' ? scenario?.dispatchReminder : undefined;
    let reply;
    if (!scenario) {
      reply = simulation.simulationClarification(call);
    } else if (dispatchReminder) {
      reply = dispatchReminder;
    } else if (!scenario.custom && (scenario.number === 2 || scenario.number === 3)) {
      reply = await report({
        sessionId: call.sessionId, text, model, messages,
        scenarioReport: {number: scenario.number, language: call.language},
      }, id => { call.workOrderId = id; });
    } else if (scenario.retrieval) {
      const previous = history.findLast(message => message.role === 'user')?.content.slice(0, 1000) ?? '';
      const context = scenario.custom ? history.slice(-8).map(({role,content}) => ({
        role, content: content.slice(0,1000),
      })) : undefined;
      const {answer} = await request('/ivr-simulation', signal, {
        id: call.id, number: scenario.number, language: call.language, text, previous, history: context,
      });
      reply = answer;
    } else {
      reply = await complete(simulation.simulationPrompt(call, scenario), messages);
    }
    if (typeof reply !== 'string' || !reply.trim()) throw new Error('SIP scenario returned an empty reply');
    if (scenario) call.scenario = scenario;
    entry.history = [...messages, {role: 'assistant', content: reply}].slice(-maxHistory);
    return dispatchReminder || normalizeReply(reply.trim());
  }

  return {start, turn};
}
