# Source-grounded knowledge and caller context

`ivr-knowledge` serves the internal Compose network at `http://knowledge:8085`. Original files are mounted read-only under `/files`:

| Source | Q/A generation |
|---|---|
| 情境模擬_20261105.docx | Scenario 2 field pairings/conversation guidance; other conversations remain labelled examples. |
| CSD資料庫.xlsx | Actual rows across every worksheet, preserving dates, leading-zero identifiers, SNs and source attribution. |
| (備品維修)PY252-0059-工單-20260602-2工-CL、JC.pdf | Source text/OCR and visually reviewed Q/A tied to the reviewed file hash. Handwritten values still require verification. |
| prompt.csv | Supporting instructions; sample facts are not indexed. |

## Caller intake and n8n storage

`POST /call-turn` registers raw caller transcripts. “我增加工单” or another report opener asks exactly one question about date, numbers and maintenance details. The next response selects `add_work_order`, even if fields are missing. `POST /work-order-draft` then prepares a flat row from registered transcripts; it does **not** persist or claim success.

The n8n workflow's native **Data Table** node creates/reuses `work_orders` and upserts that prepared row. New work orders persist in n8n's existing data volume. Unknown values stay blank, raw caller turns remain in the `transcripts` column, and a deterministic report key makes retries use the same row. No startup result or further confirmation is required. Explicit cancellation prevents saving.

`POST /work-orders` is retired. Existing `/data/work-orders.json` files are read-only legacy backups and remain accessible through `GET /work-orders`; new entries are not written there.

## Retrieval

`GET /documents?query=…` returns source-tagged `Q:` / `A:` chunks and legacy records. The workflow uses `POST /documents` with `{query,records}` to include authoritative rows read by the native Data Table node. Matching Data Table IDs override legacy JSON values. Latest/oldest/all questions use actual dispatch records, filtering months before sorting, preserving date ties and reporting genuinely unknown dates separately.

Routing accepts simplified/traditional Chinese, spoken dates and month-only follow-ups. “This month” uses Asia/Taipei time. Compact spreadsheet dates such as `202611/06` normalize to `2026-11-06` for sorting without editing the source file. Query answers do not require users to supply work-order details.

`GET /health` checks source mounts. Extraction caches by size/mtime/ctime and shares concurrent OCR. Poppler/Tesseract provide local Chinese/English PDF extraction. No Python or external generation API is needed. If Office replaces a mounted source file, recreate the knowledge service during your deployment to refresh its bind mount.

Run `npm ci --ignore-scripts && TEST_HTTP=1 npm test`. Unit checks use temporary source copies and legacy data. Native persistence and UI-visible table rows are checked by `webui/native/tests/n8n-workflow-runtime.py` in isolated containers.
