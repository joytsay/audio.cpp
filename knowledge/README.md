# Semiconductor speech-normalization wiki

This directory replaces the monolithic prompt with a wiki-shaped knowledge
base. `system-prompt.md` is always sent to the LLM in either RAG mode. The
content pages are indexed by rag-cpp with BM25 and Qwen3 embeddings generated
by the bundled llama.cpp server. The vectors are persisted directly in the
`.ragdb`. This navigation page and the system prompt are excluded from retrieval.

## Rules

- [System prompt](system-prompt.md)
- [Complete example](rules/complete-example.md)

## Terminology

- [Equipment and lithography](terminology/equipment-and-lithography.md)
- [Wafer handling and factory automation](terminology/material-handling-and-automation.md)
- [Processes and inspection](terminology/process-and-inspection.md)
- [Software](terminology/software.md)
- [Common terms and locations](terminology/common-terms.md)
- [Alarms and yield](terminology/alarms-and-yield.md)
- [Standard keywords](terminology/standard-keywords.md)

Each terminology page is intentionally small enough to form a focused RAGFlow
document while retaining headings that describe its place in the hierarchy.

## 台積電 receptionist corpus

The chatbot deployment now indexes [receptionist/overview.md](receptionist/overview.md),
section passages, and individual department/contact pages generated from `../prompt.csv`.
Markdown links connect the passages for GraphRAG. Regular RAG uses the same documents.
The original terminology pages remain available for other uses and are excluded from this
receptionist index. All chatbot grounding modes use `prompt.csv` as the system prompt.

Regenerate the repository corpus after editing `prompt.csv`:

```bash
bash .devops/generate-prompt-knowledge.sh prompt.csv knowledge/receptionist
```

The AGX entrypoint generates its runtime corpus under `/app/rag-data/receptionist-corpus`
and rebuilds the shared BM25/Qwen embedding index whenever prompt content or the generator
changes. The worker serves regular hybrid retrieval and GraphRAG local/global search.
Restart the voice-ai container after a runtime prompt edit to rebuild its index.
