# TavernExplorer

Estensione per Owlbear Rodeo con schede personaggio versionate, import Roll20,
turn order condiviso, tiri e messaggi. Il primo profilo disponibile è **D&D 5.5
(regole 2024)**.

## Avvio locale

```bash
corepack enable
pnpm install
pnpm dev
```

Nel profilo Owlbear Rodeo aggiungere l'estensione usando:

```text
http://localhost:5173/manifest.json
```

Poi abilitarla nella stanza. Il browser potrebbe richiedere il permesso di
caricare contenuti locali.

## Produzione

```bash
pnpm build
```

Pubblicare l'intera cartella `dist` su un host HTTPS e usare l'URL pubblico di
`manifest.json` come link d'installazione.

### Deploy su Vercel

Il repository include `vercel.json`. Collegare il repository a Vercel e lasciare
le impostazioni rilevate dal progetto; il deploy esegue `pnpm install
--frozen-lockfile`, `pnpm build` e pubblica `dist`.

Il link da aggiungere al profilo Owlbear sarà:

```text
https://NOME-PROGETTO.vercel.app/manifest.json
```

Ogni deploy di produzione aggiorna automaticamente l'estensione. Prima di
modifiche incompatibili è necessario aumentare `version` in `package.json` e in
`public/manifest.json`.

## Dati e sincronizzazione

- Schede, bestiario, avventure e ultimi 200 messaggi: storage locale del browser.
- Turn order: metadata della stanza Owlbear, sincronizzati con i partecipanti.
- Inventario comune: metadata della stanza Owlbear, con copia locale di sicurezza.
- Collegamento token/scheda: metadata del token.
- Nuovi messaggi e risultati: broadcast effimero Owlbear.

I contenuti 5e.tools vengono richiesti dal mirror sorgente pubblico del progetto
solo quando si sceglie una sorgente nella dialog ricercabile. L’accesso diretto
a `5e.tools/data` non viene usato perché la protezione Cloudflare blocca il fetch
cross-origin degli iframe. TavernExplorer non include i dataset nel bundle. Le
schede non vengono inviate a un server TavernExplorer. Perciò ogni giocatore deve
importare le proprie schede nel browser che userà; è consigliato esportare
backup regolari.

## Profili di regole

Il modello salva `ruleset.id` e `ruleset.version`. I calcoli specifici sono in
`src/rulesets.ts`; nuovi profili possono essere aggiunti senza cambiare il
formato generale della scheda.

## Permessi

Il GM trova una sezione **Permessi** nell’estensione. Le impostazioni vengono
salvate nei metadata della stanza e controllano modifica dell’inventario comune,
gestione di bestiario/avventure e ordine dei turni per i giocatori.

## Backup TavernPack

Da **Libreria → Esporta tutto** si scarica un file versionato conforme a
`public/tavernpack.schema.json`: personaggi, mostri, avventure, inventario
comune, messaggi e stato dei turni. Lo stesso pulsante d'importazione accetta
sia export Roll20 sia TavernPack.

## Limiti della versione 0.1

- L'importatore richiede il blocco `normalized` di `roll20-sheet-export`.
- Le formule ricavate dalle descrizioni vengono segnalate nelle note d'import.
- I tiri usano il generatore crittografico del browser e il risultato viene
  condiviso nel log; non sono ancora renderizzati come dadi 3D.
- Lo storico non viene recuperato da chi entra nella stanza dopo l'invio.
