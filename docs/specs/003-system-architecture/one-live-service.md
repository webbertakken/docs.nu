# One live service

LiveDoc has one live service, the api Worker (`apps/api`), for every kind of document and every kind of tab.
It stays that way: a new kind of document or tab joins that service, never a service of its own.

## The principle

- Every document, whatever its tabs hold (diagrams, pages, plans, sheets, forms, files), is served by the api Worker.
- Each document's content lives in that Worker's own Durable Object class, `DocumentRoom`, one object per document
  ([Document storage](../006-document/document-storage.md)).
- What the Explorer lists and every read that spans documents lives in that Worker's D1 database.
- A kind of document or tab adds tables to the document's own schema and handlers to the api Worker.
- It never adds a Worker, a Durable Object class, a D1 database or an index service of its own.

## Why

- **One set of doors.** Auth, share roles, rate limits, read-only tokens and workbench confinement are written once,
  in one Worker, and every kind of document passes through them.
- **One document, one home.** A document holding a diagram tab, a sheet and a form keeps all three in one object and
  writes them in one transaction; split across services, the same document would need a protocol between them.
- **Self-hosting stays one deploy.** A self-hoster runs one api Worker with one D1 database and one Durable Object
  class ([Open source and distribution](../002-project-scope/open-source-and-business-model.md)).
- **Upstream split, LiveDoc does not.** Upstream divides its products into separate apps over a shared index service;
  LiveDoc takes their storage mechanics, never the split
  ([Upstream](../002-project-scope/livediagram-upstream.md)).

## What it rules out

- A service per kind (a sheets service, a forms service, a pages service).
- A separate index or search service: the listing and content search are D1 tables in the api Worker
  ([Content search](../013-workspace/content-search.md)).
- A second Durable Object class for a kind of document's content.

## What it leaves alone

- The other apps stay what they are: static sites (`apps/live`, `apps/marketing`, `apps/help`, `apps/telemetry`),
  the MCP server (`apps/mcp`) and the router (`apps/router`) call the api; none of them holds document content.
- Per-person data that is not a document's content (shape libraries, the workbench, the Google Drive mirror, guest
  voters) stays in the api Worker's D1.
