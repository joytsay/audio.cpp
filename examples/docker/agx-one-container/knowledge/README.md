# Local knowledge extraction

`ivr-knowledge` is a Node.js service used only on the Compose network at
`http://knowledge:8085`. It reads these four read-only mounts from the project
root, with no Python or external inference service:

| File | Extraction |
|---|---|
| `prompt.csv` | UTF-8 text, preserving the existing prompt format |
| `情境模擬_20261105.docx` | Word paragraph text via Mammoth; labelled scenario examples |
| `CSD資料庫.xlsx` | Every worksheet via ExcelJS, with sheet/row names, dates, and zero-padded identifiers |
| `(備品維修)PY252-0059-工單-20260602-2工-CL、JC.pdf` | PDF text when present; otherwise Poppler renders pages and Tesseract reads Traditional Chinese + English |

The supplied PDF is a scanned, handwritten work report with no text layer.
OCR can lose or misread handwriting, equipment codes, SNs and quantities. Its
output is explicitly marked as OCR requiring verification against the original;
it is not a reviewed transcription. Printed and handwritten text may have very
different recognition quality. The file name is preserved even when text is
uncertain. Do not use scenario-example values to fill gaps in the PDF.

`GET /documents` returns all extracted documents and provenance. Each Excel
sheet is a separate logical document. `GET /work-orders` returns **all** populated
rows of the `派工` worksheet; it does not rely on top-K semantic retrieval for
complete listings. `GET /health` verifies that every required mount is readable
and is a regular file. No arbitrary file path, command, upload or filesystem
write is exposed by this API. Port 8085 is not published on the host.

Extraction is cached in memory by file size/mtime/ctime; changed files invalidate
their extraction and concurrent requests share the first OCR job. No call history
or user query is stored here. The first scanned-PDF query can take longer because
it performs OCR; restarting the service clears this extraction cache. n8n still
rebuilds its small Simple Vector Store per RAG invocation.

The image includes the Chinese OCR language package. Local extraction tests can
be run with `npm ci --ignore-scripts && npm test`. To include the loopback HTTP
checks, use `TEST_HTTP=1 npm test`. The tests read the actual Word/workbook
fixtures from the project root; PDF text/OCR branch tests use a controlled
executor. A real Chinese OCR pass of the supplied PDF was also checked separately.

If Office or another editor saves by replacing a file atomically, Docker's
individual file bind mount can still point at the old inode. Apply such source
updates with `docker compose up -d --no-deps --force-recreate knowledge`; this
recreates the mounts without rebuilding the image or editing n8n nodes. In-place
file edits are detected automatically on the next extraction request.
