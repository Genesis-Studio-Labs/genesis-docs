---
slug: /
sidebar_position: 0
sidebar_label: "Overview"
hide_table_of_contents: true
---

<div className="genesis-home">
  <section className="genesis-home__hero">
    <span className="genesis-home__eyebrow">Genesis Studio Documentation</span>
    <h1>Internal docs for the Genesis platform</h1>
    <p className="genesis-home__lede">
      This site collects the current technical documentation from the Genesis Studio codebase: architecture,
      data model, API surface, frontend systems, operations, and supporting workflows.
    </p>
  </section>

  <section className="genesis-home__grid">
    <a className="genesis-home__card" href="./01-Architecture-Overview">
      <h2>Architecture &amp; Backend</h2>
      <p>System design, database schema, Directus integration, API reference, auth, payments, image pipeline, and state management.</p>
      <div className="genesis-home__meta">Docs 01-08</div>
    </a>

    <a className="genesis-home__card" href="./09-UI-Homepage">
      <h2>Frontend &amp; UI</h2>
      <p>Page-level flows, chapter reading, comments, store, library, common components, and the styling system.</p>
      <div className="genesis-home__meta">Docs 09-17</div>
    </a>

    <a className="genesis-home__card" href="./18-SEO-Metadata">
      <h2>Operations</h2>
      <p>SEO, metadata, scripts, environment setup, and developer workflow details for shipping and maintaining the app.</p>
      <div className="genesis-home__meta">Docs 18-19</div>
    </a>
  </section>
</div>

## Recommended Reading Paths

### New Developer Onboarding
1. [Architecture Overview](./01-Architecture-Overview.md)
2. [Scripts & Development Setup](./19-Scripts-Development-Setup.md)
3. [Authentication System](./05-Authentication-System.md)
4. [State Management](./08-State-Management.md)
5. The UI docs most relevant to your first task

### Backend Focus
- [Architecture Overview](./01-Architecture-Overview.md)
- [Database Schema](./02-Database-Schema.md)
- [Directus CMS Integration](./03-Directus-CMS-Integration.md)
- [API Reference](./04-API-Reference.md)
- [Payment & Subscription System](./06-Payment-Subscription-System.md)

### Frontend Focus
- [Architecture Overview](./01-Architecture-Overview.md)
- [State Management](./08-State-Management.md)
- [UI: Homepage](./09-UI-Homepage.md)
- [UI: Common Components](./16-UI-Common-Components.md)
- [UI: Styling System](./17-UI-Styling-System.md)

## Documentation Set

| Area | Included docs |
| --- | --- |
| Architecture & Backend | 01-08 |
| Frontend & UI | 09-17 |
| Operations | 18-19 |

The documentation here is imported from `/home/ragingstar/Programming/genesis-site/docs` and lightly adapted for Docusaurus navigation and cross-linking.
