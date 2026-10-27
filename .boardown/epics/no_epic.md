---
{}
---

## Avoid party sheet write collisions

---
id: TE-5
type: tech
priority: high
status: todo
order: 100
---

Replace whole-array room metadata writes or add conflict handling when multiple players publish sheets concurrently.

## Offer late-join message history

---
id: TE-6
type: feature
priority: medium
status: todo
order: 200
---

Design persistence that preserves privacy for GM-only and personal messages.

## Search local bestiary and adventures

---
id: TE-8
type: feature
priority: low
status: todo
order: 300
---

Filter imported content by name, source, and challenge rating without loading another manual.

## Storage autenticato per dati condivisi

---
id: TE-15
type: tech
priority: high
status: todo
order: 700
---

Sostituire i metadata Owlbear come storage primario per schede e note con un servizio persistente autenticato, ACL per elemento e scritture atomiche. Migrare i dati esistenti senza perdita.
