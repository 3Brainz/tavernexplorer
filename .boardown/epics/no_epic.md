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

## Valutare storage condiviso oltre i metadata

---
id: TE-15
type: tech
priority: high
status: todo
order: 700
---

Confrontare le API documentate di room, player, scene e assets con i requisiti: dati disponibili tra scene e sessioni, quota, permessi per elemento e modifiche simultanee. I 200 MB cloud del piano gratuito non aumentano il limite dei metadata room. Scegliere uno storage adatto basandosi sulla documentazione; valutare un servizio autenticato solo se le API Owlbear non coprono i requisiti. Pianificare una migrazione senza perdita.
