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

## Ripristinare deploy Vercel dopo rate limit

---
id: TE-22
type: tech
priority: high
status: todo
order: 1400
---

Il commit bb2e5a0 ha Action verde ma Vercel ha risposto Deployment rate limited, retry in 24 hours. Dopo il limite, rilanciare il deploy e verificare che manifest.json pubblico corrisponda al commit; valutare un controllo automatico della versione servita.

## Creare un personaggio da zero

---
id: TE-23
type: feature
priority: high
status: todo
order: 1500
---

Oggi le schede arrivano solo da import Roll20 o TavernPack. Aggiungere in Libreria una scheda vuota D&D 5.5 modificabile (identità, caratteristiche, competenze, CA, PF, dadi vita, slot), con bonus di competenza e modificatori calcolati dal profilo di regole.

## PF dei mostri nel turn order

---
id: TE-24
type: feature
priority: high
status: todo
order: 1600
---

`TurnEntry` non ha PF: il GM non può tracciare danni su più copie dello stesso mostro. Aggiungere PF correnti/massimi/temporanei per voce (o token), inizializzati da `hp.average` o tirando `hp.formula`, con danni/cure rapidi riusando `applyHitPointAction`. Mostrare ai giocatori solo lo stato (illeso/ferito/sanguinante) secondo i permessi.

## Tiri salvezza contro la morte

---
id: TE-25
type: feature
priority: high
status: todo
order: 1700
---

A 0 PF `HitPointControl` mostra solo un avviso manuale. Aggiungere tiro d20 dalla scheda con regole 5.5: 10+ successo, 1 = due fallimenti, 20 = torna a 1 PF; danno a 0 PF = un fallimento (critico = due), danno massiccio = morte; 3 successi = stabile. Registrare l'esito nei messaggi e coprire con test.

## Colpi critici sui danni

---
id: TE-26
type: feature
priority: high
status: todo
order: 1800
---

`Ruleset.criticalDamage` esiste ma non è usato. Dopo un tiro per colpire con 20 naturale offrire il tiro di danno critico (dadi raddoppiati, modificatori no), sia per azioni dei PG sia per mostri.

## Indebolimento 2024

---
id: TE-27
type: feature
priority: high
status: todo
order: 1900
---

Aggiungere livelli di Indebolimento (0-6) alla scheda e al tracker: −2 per livello a ogni tiro d20, −5 ft di velocità per livello, morte a 6; riposo lungo rimuove un livello. Applicare la penalità ai tiri d20 e nascondere/mostrare lo stato sul token come le altre condizioni.

## Lanciare un incantesimo

---
id: TE-28
type: feature
priority: medium
status: todo
order: 2000
---

Pulsante "Lancia" sugli incantesimi: scelta del livello dello slot (cast potenziato), consumo dello slot, rituale senza slot, tiro attacco/danno o CD nei messaggi. Bloccare se non ci sono slot disponibili.

## Concentrazione

---
id: TE-29
type: feature
priority: medium
status: todo
order: 2100
---

Tracciare l'incantesimo su cui il personaggio si concentra (uno alla volta, sostituito al nuovo lancio). Quando subisce danno proporre il TS Costituzione con CD max(10, metà danno) fino a 30; a 0 PF o Incapacitato la concentrazione termina. Mostrare lo stato sul token.

## Weapon Mastery

---
id: TE-30
type: feature
priority: medium
status: todo
order: 2200
---

Campo proprietà di maestria sulle azioni arma (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex) con descrizione breve nel tiro; import da Roll20/5e.tools quando presente.

## Ispirazione eroica

---
id: TE-31
type: feature
priority: medium
status: todo
order: 2300
---

Il booleano `inspiration` non ha uso. Permettere di spenderla per ritirare un d20 appena tirato dai messaggi, consumandola sulla scheda; il GM può assegnarla dal Party.

## Resistenze, vulnerabilità e immunità

---
id: TE-32
type: feature
priority: medium
status: todo
order: 2400
---

Salvare resistenze/vulnerabilità/immunità ai tipi di danno e alle condizioni per PG e mostri (import 5e.tools). Nel controllo PF scegliere il tipo di danno e applicare metà/doppio/zero con anteprima.

## Effetti meccanici delle condizioni

---
id: TE-33
type: feature
priority: low
status: todo
order: 2500
---

Le condizioni del tracker sono solo etichette. Suggerire vantaggio/svantaggio nei tiri in base alle condizioni attive (es. Avvelenato: svantaggio su attacchi e prove; Prono; Trattenuto) senza forzare il tiro.

## Salire di livello

---
id: TE-34
type: feature
priority: medium
status: todo
order: 2600
---

Procedura guidata: aumento livello, PF (tiro o valore fisso + COS), dadi vita, bonus di competenza e slot secondo la progressione di classe (incluso multiclasse e Magia del Patto). Mostrare anteprima delle differenze prima di salvare.

## Sintonia e munizioni

---
id: TE-35
type: feature
priority: low
status: todo
order: 2700
---

Flag sintonia sugli oggetti (max 3, solo sintonizzati applicano modificatori se richiesta) e collegamento azione → munizione che scala il conteggio a ogni attacco.

## Azioni leggendarie e tiri dei mostri

---
id: TE-36
type: feature
priority: medium
status: todo
order: 2800
---

Contatori per azioni leggendarie (ripristino all'inizio del turno del mostro) e resistenze leggendarie per giorno. Pulsanti di tiro su TS e abilità dei mostri.

## Budget PE degli incontri

---
id: TE-37
type: feature
priority: low
status: todo
order: 2900
---

Calcolare la difficoltà dell'incontro con le tabelle PE 2024 in base a livelli del party e GS dei mostri; integrare con gli incontri salvati di TE-18.
