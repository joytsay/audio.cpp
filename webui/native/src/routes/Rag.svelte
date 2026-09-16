<script lang="ts">
  import { onMount } from 'svelte';
  import { chatText, endpointJson, endpointRouterModels, formatChatMessages, siblingWorkerEndpoint, type ChatMessage, type OpenAIModel } from '$lib/openai';
  import { graphCitations, graphContext, graphSearch, indexKnowledgeDocument, matchedExampleOutput, type GraphMode, type GraphResult } from '$lib/rag';
  import bundledKnowledgeSystemPrompt from '../../../../knowledge/system-prompt.md?raw';

  interface KnowledgeFile {
    path: string;
    uri: string;
    content: string;
  }

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
  let llmInputPreview = '';
  let knowledgeFiles: KnowledgeFile[] = [];
  let knowledgeSystemPrompt = bundledKnowledgeSystemPrompt;
  let knowledgeStatus = 'Loading knowledge files…';
  let savingKnowledge = '';

  async function refreshModels() {
    models = await endpointRouterModels(llmBaseUrl);
    if (!models.some((entry) => entry.id === model)) model = models[0]?.id || '';
  }

  async function refreshKnowledge() {
    knowledgeStatus = 'Loading knowledge files…';
    try {
      const response = await endpointJson<{ files?: KnowledgeFile[] }>(audioBaseUrl, 'ui/knowledge');
      knowledgeFiles = response.files || [];
      knowledgeSystemPrompt = knowledgeFiles.find((file) => file.path === 'system-prompt.md')?.content || bundledKnowledgeSystemPrompt;
      knowledgeStatus = `${knowledgeFiles.length} Markdown files loaded.`;
    } catch (error) {
      knowledgeStatus = error instanceof Error ? error.message : String(error);
    }
  }

  async function saveKnowledge(file: KnowledgeFile) {
    if (savingKnowledge) return;
    savingKnowledge = file.path;
    knowledgeStatus = `Saving ${file.path}…`;
    try {
      const saved = await endpointJson<KnowledgeFile>(audioBaseUrl, 'ui/knowledge', {
        method: 'POST',
        body: JSON.stringify({ path: file.path, content: file.content })
      });
      await indexKnowledgeDocument(audioBaseUrl, {
        uri: saved.uri,
        title: saved.path.split('/').pop()?.replace(/\.md$/i, '') || saved.path,
        text: saved.content
      });
      knowledgeFiles = knowledgeFiles.map((entry) => entry.path === saved.path ? saved : entry);
      if (saved.path === 'system-prompt.md') knowledgeSystemPrompt = saved.content;
      knowledgeStatus = `${saved.path} saved and reindexed.`;
    } catch (error) {
      knowledgeStatus = error instanceof Error ? error.message : String(error);
    } finally {
      savingKnowledge = '';
    }
  }

  async function run() {
    if (!query.trim() || searching) return;
    searching = true;
    result = null;
    answer = '';
    llmInputPreview = '';
    try {
      status = `Running RAG ${mode} search…`;
      result = await graphSearch(audioBaseUrl, query.trim(), mode, topK);
      const context = graphContext(result);
      if (!context) throw new Error('RAG returned no relevant knowledge.');
      const exampleOutput = matchedExampleOutput(result, query.trim());
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `${knowledgeSystemPrompt.trim()}\n\n# 檢索知識\n\n以下內容是本次正規化的權威參考資料。必須套用明確命中的「左側詞 => 右側詞」。若最高相關結果是與使用者相同話語的完整「輸入／輸出」範例，即使輸入含有重複、標點、語助詞、漏字或近音誤字，也必須只輸出該範例的「輸出：」內容。不要輸出來源、分數、解釋或範例說明。\n\n${context}`
        },
        { role: 'user', content: query.trim() }
      ];
      llmInputPreview = formatChatMessages(messages);
      if (!model) {
        status = 'Retrieval complete. Select an LLM to generate an answer.';
        return;
      }
      status = 'Generating a grounded response…';
      const response = await endpointJson<any>(llmBaseUrl, 'chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false
        })
      });
      answer = exampleOutput || chatText(response);
      status = exampleOutput ? 'RAG response complete · matched normalization example.' : 'RAG response complete.';
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      searching = false;
    }
  }

  onMount(async () => {
    audioBaseUrl = new URL('v1/', document.baseURI).toString().replace(/\/$/, '');
    llmBaseUrl = siblingWorkerEndpoint(8082);
    try { await Promise.all([refreshModels(), refreshKnowledge()]); }
    catch (error) { status = error instanceof Error ? error.message : String(error); }
  });
</script>

<section class="page-head">
  <p class="eyebrow">KNOWLEDGE RETRIEVAL</p>
  <h1>RAG</h1>
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
    {#if llmInputPreview}
      <label class="llm-input-preview">LLM input<textarea readonly rows="14" value={llmInputPreview}></textarea></label>
    {/if}
    {#if answer}<article class="pipeline-message assistant"><span>LLM</span><p>{answer}</p></article>{/if}
    {#if !result && !answer}<div class="empty-output"><div class="wave">⌘</div><p>RAG context and citations will appear here.</p></div>{/if}
  </section>
</div>

<section class="panel page-panel knowledge-editor">
  <div class="section-title">
    <div><span>KNOWLEDGE</span><h2>Markdown editor</h2></div>
    <button disabled={Boolean(savingKnowledge)} on:click={refreshKnowledge}>Refresh files</button>
  </div>
    <p class="field-help">Expand a document to edit it. Saving updates the Markdown file and the running RAG index.</p>
  <div class="knowledge-accordion">
    {#each knowledgeFiles as file (file.path)}
      <details>
        <summary><span>{file.path}</span><small>{file.content.length.toLocaleString()} characters</small></summary>
        <div class="knowledge-document">
          <textarea bind:value={file.content} rows="16" spellcheck="false" aria-label={`Edit ${file.path}`}></textarea>
          <div class="knowledge-actions">
            <button class="primary" disabled={Boolean(savingKnowledge)} on:click={() => saveKnowledge(file)}>
              {savingKnowledge === file.path ? 'Saving…' : 'Save Markdown'}
            </button>
          </div>
        </div>
      </details>
    {/each}
  </div>
  <p class:busy={Boolean(savingKnowledge)} class="knowledge-status">{knowledgeStatus}</p>
</section>
