<script lang="ts">
  import { onMount } from 'svelte';
  import { endpointJson } from '$lib/openai';
  import { graphCitations, graphSearch, indexKnowledgeDocument, ragSearch, type GraphMode, type GraphResult, type RagMode } from '$lib/rag';

  interface KnowledgeFile {
    path: string;
    uri: string;
    content: string;
  }

  let audioBaseUrl = '';
  let query = '';
  let mode: GraphMode | RagMode = 'dense';
  let topK = 5;
  let searching = false;
  let status = 'Search the semiconductor knowledge base.';
  let result: GraphResult | null = null;
  let citations: string[] = [];
  let knowledgeFiles: KnowledgeFile[] = [];
  let knowledgeStatus = 'Loading knowledge files…';
  let savingKnowledge = '';
  let ragInfo = 'Loading index status…';

  async function refreshRagInfo() {
    ragInfo = 'Loading index status…';
    try {
      const response = await endpointJson<{ output: string }>(audioBaseUrl, 'rag/info');
      ragInfo = response.output.trim() || 'No index information returned.';
    } catch (error) {
      ragInfo = error instanceof Error ? error.message : String(error);
    }
  }

  async function refreshKnowledge() {
    knowledgeStatus = 'Loading knowledge files…';
    try {
      const response = await endpointJson<{ files?: KnowledgeFile[] }>(audioBaseUrl, 'ui/knowledge');
      knowledgeFiles = response.files || [];
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
      const isControlFile = /(^|[\\/])(README|system-prompt)\.md$/i.test(saved.path);
      if (!isControlFile) {
        await indexKnowledgeDocument(audioBaseUrl, {
          uri: saved.uri,
          title: saved.path.split('/').pop()?.replace(/\.md$/i, '') || saved.path,
          text: saved.content
        });
      }
      knowledgeFiles = knowledgeFiles.map((entry) => entry.path === saved.path ? saved : entry);
      knowledgeStatus = isControlFile
        ? `${saved.path} saved.`
        : `${saved.path} saved and reindexed.`;
      if (!isControlFile) await refreshRagInfo();
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
    citations = [];
    try {
      status = `Running ${mode === 'local' || mode === 'global' ? 'GraphRAG' : 'RAG'} ${mode} search…`;
      result = mode === 'local' || mode === 'global'
        ? await graphSearch(audioBaseUrl, query.trim(), mode, topK)
        : await ragSearch(audioBaseUrl, query.trim(), topK, undefined, mode);
      citations = graphCitations(result);
      const count = (result.hits?.length || 0) + (result.communities?.length || 0);
      status = count
        ? `${count} result${count === 1 ? '' : 's'} retrieved.`
        : result.summary?.trim() ? 'Summary retrieved.' : 'No matching passages found.';
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      searching = false;
    }
  }

  onMount(async () => {
    audioBaseUrl = new URL('v1/', document.baseURI).toString().replace(/\/$/, '');
    await Promise.all([refreshKnowledge(), refreshRagInfo()]);
  });
</script>

<section class="page-head">
  <p class="eyebrow">KNOWLEDGE RETRIEVAL</p>
  <h1>RAG</h1>
  <p>Retrieve passages from the local knowledge base using Qwen embeddings.</p>
</section>

<div class="rag-grid">
  <section class="panel page-panel">
    <div class="section-title"><div><span>QUERY</span><h2>Knowledge search</h2></div></div>
    <label>Question<textarea bind:value={query} rows="7" placeholder="Enter a semiconductor term, alarm, process, or normalization question"></textarea></label>
    <div class="field-grid">
      <label>Retrieval mode<select bind:value={mode}><option value="dense">Qwen embeddings — dense</option><option value="hybrid">Qwen embeddings + BM25 — hybrid</option><option value="local">GraphRAG — related passages</option><option value="global">GraphRAG — community overview</option></select></label>
      <label>Results<input type="number" min="1" max="20" bind:value={topK} /></label>
    </div>
    <div class="page-runbar"><button class="primary" disabled={searching || !query.trim()} on:click={run}>{searching ? 'Searching…' : 'Search knowledge'}</button><span class:busy={searching}>{status}</span></div>
  </section>

  <section class="panel page-panel rag-results">
    <div class="section-title"><div><span>RESULTS</span><h2>Retrieved knowledge</h2></div></div>
    {#if result}
      {#if result.summary?.trim()}
        <article class="pipeline-message diarization"><span>SUMMARY</span><p>{result.summary}</p></article>
      {/if}
      {#each result.hits || [] as hit, index}
        <article class="pipeline-message diarization">
          <span>RESULT {index + 1}{#if typeof hit.score === 'number' && Number.isFinite(hit.score)} · SCORE {hit.score.toFixed(3)}{/if}</span>
          <p>{hit.text}</p>
          {#if citations[index]}<div class="rag-citations"><code>{citations[index]}</code></div>{/if}
        </article>
      {/each}
      {#each result.communities || [] as community}
        <article class="pipeline-message diarization">
          <span>COMMUNITY {community.id ?? ''}{#if community.size} · {community.size} MEMBERS{/if}</span>
          {#if community.title}<h3>{community.title}</h3>{/if}
          {#if community.summary}<p>{community.summary}</p>{/if}
        </article>
      {/each}
      {#if !result.hits?.length && !result.communities?.length && !result.summary?.trim()}
        <div class="empty-output"><div class="wave">⌘</div><p>No matching passages found.</p></div>
      {/if}
    {:else}
      <div class="empty-output"><div class="wave">⌘</div><p>Retrieved passages and sources will appear here.</p></div>
    {/if}
  </section>
</div>

<section class="panel page-panel rag-index-info">
  <div class="section-title">
    <div><span>INDEX</span><h2>Knowledge database</h2></div>
    <button on:click={refreshRagInfo}>Refresh status</button>
  </div>
  <p class="field-help">Output of <code>ragcpp info /app/rag-data/knowledge.ragdb</code>.</p>
  <pre>{ragInfo}</pre>
</section>

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
