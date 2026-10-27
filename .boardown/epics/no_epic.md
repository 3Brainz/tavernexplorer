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

Rilievi documentati: room metadata <16 kB complessivi e scrittura parziale senza CAS; scene/item metadata sono legati alla scena; l'API player espone i metadata del giocatore corrente; assets espone immagini e scene, senza CRUD JSON generico. Per schede e note grandi, permanenti e con permessi verificati, progettare uno store applicativo con autenticazione indipendente, migrazione idempotente e backup TavernPack. Conservare in room metadata solo stato breve e riferimenti. Non trasferire note private sul server prima di definire l'identità e l'ACL.

Fonti: https://docs.owlbear.rodeo/extensions/apis/room/ ; https://docs.owlbear.rodeo/extensions/apis/scene/ ; https://docs.owlbear.rodeo/extensions/apis/player/ ; https://docs.owlbear.rodeo/extensions/apis/assets/ ; https://docs.owlbear.rodeo/docs/migration/migrate-from-1-to-2/#cloud-storage

## Incontri pronti da avviare

---
id: TE-18
type: feature
priority: medium
status: todo
order: 1000
---

Salvare gruppi di mostri e iniziative come incontro riutilizzabile, collegarli ai token della scena e avviare o chiudere il combattimento con controllo prima di sovrascrivere il tracker.

## Ricerca rapida durante la sessione

---
id: TE-19
type: feature
priority: medium
status: todo
order: 1100
---

Cercare personaggi, mostri, avventure e note accessibili senza riaprire cataloghi; filtrare per nome, fonte e GS dove applicabile.

## Storage condiviso con ACL reali

---
id: TE-20
type: feature
priority: high
status: todo
order: 1200
---

Progettare autenticazione, permessi server per elemento, scritture atomiche e migrazione idempotente dalle room metadata. Conservare backup TavernPack e verificare la privacy prima di spostare schede e note.

## Cronologia azioni di combattimento

---
id: TE-21
type: feature
priority: high
status: todo
order: 1300
---

Registrare danni, cure, PF temporanei e condizioni con autore, bersaglio e visibilità; permettere annullamento sicuro quando la versione della scheda non è cambiata.
