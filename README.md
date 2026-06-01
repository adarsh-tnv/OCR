# ISO Certificate OCR Platform

Production-grade OCR and AI extraction platform for ISO and compliance certificates.

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, TanStack Query, Zustand, React Hook Form, Zod
- Backend: Node.js, Express, TypeScript, Prisma, MongoDB
- Queue: BullMQ and Redis
- Storage: AWS S3 with signed preview URLs
- OCR: AWS Textract
- AI extraction and file chat: Google Gemini with JSON responses
- Realtime: Socket.IO job updates

## Features

- Multi-file drag and drop upload for PDF, PNG, JPG, and JPEG
- S3 file storage and signed preview URLs
- Async OCR and extraction pipeline with retry handling
- AWS Textract extraction of raw text, tables, form fields, and page metadata
- Gemini extraction into strongly validated certificate JSON
- Predefined field extraction from any uploaded file using configurable default fields
- Chat with uploaded files using OCR text, tables, form fields, and extracted metadata as context
- ISO/compliance standard detection for ISO 9001, ISO 14001, ISO 27001, ISO 22000, ISO 45001, CE, GMP, HACCP, and other certificates
- Validation for expiry, duplicate certificate numbers, missing fields, OCR confidence, suspicious text, and date consistency
- Review queue with manual correction and comments
- Extraction history
- Dashboard statistics and charts
- Search and advanced filters
- Export to JSON, CSV, Excel, and PDF

## Monorepo

```text
apps/
  api/       Express API, Prisma schema, services, queue worker
  web/       Next.js application
packages/
  shared/    Zod schemas, constants, shared TypeScript contracts
docs/
  prompts.md
```

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Fill AWS, Textract, and Gemini credentials in `.env`.

4. Start MongoDB, Redis, API, worker, and web:

```bash
docker compose up --build
```

5. Push the MongoDB schema:

```bash
npm run db:migrate
```

The web app runs at `http://localhost:3000`; the API runs at `http://localhost:4000`.

## Local Development

```bash
npm run prisma:generate
npm run dev
```

For local development without external OCR or AI calls, set:

```text
OCR_PROVIDER=mock
AI_PROVIDER=mock
```

## API Surface

Files:

- `POST /api/files/upload`
- `GET /api/files`
- `GET /api/files/:id`
- `GET /api/files/:id/preview`
- `GET /api/files/extraction-fields/defaults`
- `POST /api/files/:id/extract-fields`
- `POST /api/files/:id/chat`
- `DELETE /api/files/:id`

OCR:

- `POST /api/ocr/:fileId/process`
- `POST /api/ocr/:fileId/retry`
- `GET /api/ocr/:fileId`

Certificates:

- `GET /api/certificates`
- `GET /api/certificates/:id`
- `GET /api/certificates/file/:fileId`
- `PATCH /api/certificates/:id`
- `POST /api/certificates/:id/comments`

Dashboard:

- `GET /api/dashboard/statistics`
- `GET /api/dashboard/charts`

Review:

- `GET /api/review/queue`

Exports:

- `GET /api/exports/certificates/:id?format=json`
- `GET /api/exports/certificates/:id?format=csv`
- `GET /api/exports/certificates/:id?format=xlsx`
- `GET /api/exports/certificates/:id?format=pdf`

## Processing Flow

1. API validates files and uploads them to S3.
2. API creates an `uploaded_files` row and a queued `processing_jobs` row.
3. BullMQ worker downloads the file from S3.
4. AWS Textract returns OCR text, tables, form fields, metadata, and confidence.
5. Gemini receives OCR context and returns strict JSON.
6. Validation service checks standard patterns, dates, duplicates, OCR confidence, missing fields, and suspicious text.
7. Results are stored in `extracted_certificates` and `extraction_history`.
8. UI shows status updates, extracted data, OCR text, preview, comments, and correction form.

## Production Notes

- Keep S3 buckets private and serve documents only through signed URLs.
- Use IAM roles in production instead of static AWS access keys when possible.
- Run the worker as an independently scaled service.
- Put Redis and MongoDB on managed services with backups enabled.
- Set `CORS_ORIGIN` to explicit domains.
- Keep `GEMINI_MODEL` pinned unless you intentionally evaluate and approve a model migration.
- Give the AWS credentials permission to read the S3 bucket and call Textract `AnalyzeDocument`.
- Add authentication and role-based authorization before exposing the app to external users.
