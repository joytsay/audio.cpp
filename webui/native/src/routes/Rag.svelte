<script lang="ts">
  import { onMount } from 'svelte';
  import { chatText, endpointJson, endpointRouterModels, siblingWorkerEndpoint, type OpenAIModel } from '$lib/openai';
  import { graphCitations, graphContext, graphSearch, type GraphMode, type GraphResult } from '$lib/rag';
  import knowledgeSystemPrompt from '../../../../knowledge/system-prompt.md?raw';

  let audioBaseUrl = '';
  let llmBaseUrl = '';
  let models: OpenAIModel[] = [];
  let model = '';
  let query = '';
  let mode: GraphMode = 'local';
  let topK = 5;
  let temperature = 0.2;
  let maxTokens = 512;
  let searching = false;
  let status = 'Ask a question about the semiconductor knowledge base.';
  let result: GraphResult | null = null;
  let answer = '';

  async function refreshModels() {
    models = await endpointRouterModels(llmBaseUrl);
    if (!models.some((entry) => entry.id === model)) model = models[0]?.id || '';
  }

  async function run() {
    if (!query.trim() || searching) return;
    searching = true;
    result = null;
    answer = '';
    try {
      status = `Running GraphRAG ${mode} search…`;
      result = await graphSearch(audioBaseUrl, query.trim(), mode, topK);
      const context = graphContext(result);
      if (!context) throw new Error('GraphRAG returned no relevant knowledge.');
      if (!model) {
        status = 'Retrieval complete. Select an LLM to generate an answer.';
        return;
      }
      status = 'Generating a grounded response…';
      const response = await endpointJson<any>(llmBaseUrl, 'chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: `${knowledgeSystemPrompt.trim()}\n\nUse only the retrieved knowledge below when it is relevant. Preserve technical spelling exactly.\n\n${context}` },
            { role: 'user', content: query.trim() }
          ],
          temperature,
          max_tokens: maxTokens,
          stream: false
        })
      });
      answer = chatText(response);
      status = 'GraphRAG response complete.';
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      searching = false;
    }
  }

  onMount(async () => {
    audioBaseUrl = new URL('v1/', document.baseURI).toString().replace(/\/$/, '');
    llmBaseUrl = siblingWorkerEndpoint(8082);
    try { await refreshModels(); }
    catch (error) { status = error instanceof Error ? error.message : String(error); }
  });
</script>

<section class="page-head">
  <p class="eyebrow">KNOWLEDGE RETRIEVAL</p>
  <h1>GraphRAG</h1>
  <p>Search the local semiconductor knowledge graph and generate a source-grounded response.</p>
</section>

<div class="rag-grid">
  <section class="panel page-panel">
    <div class="section-title"><div><span>QUERY</span><h2>Knowledge search</h2></div><button disabled={searching} on:click={refreshModels}>Refresh</button></div>
    <label>Question<textarea bind:value={query} rows="7" placeholder="Enter a semiconductor term, alarm, process, or normalization question"></textarea></label>
    <div class="field-grid">
      <label>Graph search<select bind:value={mode}><option value="local">Local — related passages</option><option value="global">Global — community overview</option></select></label>
      <label>Results<input type="number" min="1" max="20" bind:value={topK} /></label>
    </div>
    <label>LLM model<select bind:value={model}>{#each models as entry}<option value={entry.id}>{entry.id}</option>{/each}</select></label>
    <div class="field-grid compact-fields">
      <label>Temperature<input type="number" min="0" max="2" step="0.05" bind:value={temperature} /></label>
      <label>Max tokens<input type="number" min="1" max="32768" bind:value={maxTokens} /></label>
    </div>
    <div class="page-runbar"><button class="primary" disabled={searching || !query.trim()} on:click={run}>{searching ? 'Searching…' : 'Search & generate'}</button><span class:busy={searching}>{status}</span></div>
  </section>

  <section class="panel page-panel rag-results">
    <div class="section-title"><div><span>RESULTS</span><h2>Grounded answer</h2></div></div>
    {#if result}
      <article class="pipeline-message diarization"><span>GRAPH CONTEXT</span><p>{graphContext(result)}</p></article>
      {#if graphCitations(result).length}<div class="rag-citations"><strong>Sources</strong>{#each graphCitations(result) as citation}<code>{citation}</code>{/each}</div>{/if}
    {/if}
    {#if answer}<article class="pipeline-message assistant"><span>LLM</span><p>{answer}</p></article>{/if}
    {#if !result && !answer}<div class="empty-output"><div class="wave">⌘</div><p>GraphRAG context and citations will appear here.</p></div>{/if}
  </section>
</div>
