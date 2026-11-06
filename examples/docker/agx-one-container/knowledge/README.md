# Read-only local knowledge extraction

`ivr-knowledge` is a Node.js service on the internal Compose network at
`http://knowledge:8085`. It reads four read-only project-root mounts:

| File | Extraction |
|---|---|
| prompt.csv | UTF-8 maintenance rules |
| 情境模擬_20261105.docx | Mammoth text extraction, labelled scenario examples |
| CSD資料庫.xlsx | ExcelJS, all worksheets with dates and leading-zero identifiers |
| (備品維修)PY252-0059-工單-20260602-2工-CL、JC.pdf | Text layer or Poppler/Tesseract Traditional Chinese and English OCR |

`GET /health` checks readable files. `GET /documents` returns source-tagged
knowledge for RAG, with separate logical documents for each workbook sheet.
POST/PATCH/PUT/DELETE requests are rejected. There are no work-order CRUD,
CSV conversion, database-write or arbitrary-file endpoints. No Python is needed.
The previously generated CSV and backups are preserved on the host but unused.

Extraction is cached by source file size/mtime/ctime. Concurrent requests share
OCR. Query text and call history are not cached here. Scanned handwriting can
be misread: OCR codes, dates and quantities must be verified against the PDF.

All four files must exist on the AGX. Following file replacements by Office,
recreate this service to refresh the read-only file bind mounts:
`docker compose up -d --no-deps --force-recreate knowledge`.

Run `npm ci --ignore-scripts && npm test`. Include HTTP endpoint checks with
`TEST_HTTP=1 npm test`; tests use temporary file copies and do not write sources.
