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
  Il GM puo' avanzare o tornare al turno precedente, ritirare l'iniziativa e
  annotare condizioni con durata in round. Le condizioni scadono all'inizio
  del turno del combattente dopo il numero di round indicato.
- Inventario comune: metadata della stanza Owlbear, con copia locale di sicurezza.
- Note: private per impostazione predefinita nel browser, oppure pubblicate nella
  stanza per la lettura del party. Per ogni nota condivisa l'autore sceglie se
  consentire la scrittura solo a sé, anche al GM, o a tutto il party. Può
  riportare la nota in privato. Una copia riservata al GM si invia come messaggio
  cifrato; non è una nota collaborativa persistente. Le cartelle organizzano
  note private e condivise per ciascun browser: si possono creare, rinominare,
  eliminare e assegnare alle note senza cambiare i permessi condivisi.
- Party: le schede nuove sono private nel browser. In **Libreria** si puo' scegliere
  per ogni scheda **Solo questo browser** oppure **Tutto il party**. Solo le schede
  condivise sono pubblicate nei metadata della stanza e del giocatore. Le schede
  gia' salvate senza una scelta esplicita vengono trattate come private. Il DM
  vede e modifica solo le schede condivise, insieme ai delegati autorizzati.
- Turn order e messaggi possono essere aperti come pannelli flottanti sulla mappa.
- Buff, debuff e proprietà numeriche degli oggetti equipaggiati modificano CA,
  iniziativa, PF massimi, caratteristiche, tiri salvezza, abilità, CD, attacchi
  e danni senza riscrivere i valori di base. Gli oggetti nello zaino e gli
  effetti disattivati non si applicano. La durata degli effetti sulla scheda
  si aggiorna manualmente; le condizioni del tracker scadono per round.
- Le mappe individuate nelle avventure 5e.tools possono essere caricate
  direttamente come scene Owlbear.
- Collegamento token/scheda: metadata del token. Dal Party il DM assegna una
  scheda al token selezionato, la scollega o ne trasferisce la proprieta' a un
  altro giocatore. Il menu contestuale del token apre la scheda collegata;
  non assegna automaticamente la scheda attiva ai token scollegati.
- Import bestiario: dopo aver caricato un manuale o un file JSON, si scelgono
  uno o piu' mostri. Solo quelli selezionati vengono salvati e caricati come
  token `CHARACTER` con nome `beasts/<nome>`. Quando il mirror non espone
  l'immagine viene generato un token di riserva con le iniziali del mostro.
- Nuovi messaggi e risultati: broadcast effimero Owlbear.
- Note dei giocatori: ogni nota viene salvata localmente, inclusa nel TavernPack
  e puo' essere inviata individualmente al party o al GM. L'invio crea una copia
  nel registro messaggi; la nota originale resta modificabile solo nel browser.

**Privacy:** bestiario e avventure restano nel browser che li ha importati; non
sono sincronizzati con gli altri partecipanti. I messaggi “Solo io” restano
locali. I nuovi messaggi “Solo GM” sono cifrati nel browser prima del broadcast
Owlbear. Il GM deve aver aperto l'estensione per pubblicare la sua chiave
pubblica. La chiave privata resta nel browser del GM; se quel browser viene
azzerato, i nuovi messaggi useranno una nuova chiave. Le vecchie copie locali
dei messaggi inviati con versioni precedenti non vengono cifrate retroattivamente.
I riepiloghi dei mostri e gli estratti delle avventure partono da “Privato”:
l'invio di una copia al party o al GM richiede una scelta per ogni elemento.

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
comune, note private e cartelle personali, messaggi e stato dei turni. Le note condivise restano nei
metadata della stanza e non sono incluse nel file. Lo stesso pulsante d'importazione accetta
sia export Roll20 sia TavernPack.

## Tiri di dado

Ogni formula `d20` con modificatore apre una scelta Normale / Vantaggio /
Svantaggio prima del tiro; le altre formule (danni compresi) tirano subito con la
modalita' selezionata nella scheda. Il risultato viene scritto nel log dei
messaggi, trasmesso via Owlbear quando condiviso e, quando la visibilita' e' "Tutti" e il
personaggio ha un token collegato, mostrato per qualche secondo sulla mappa
accanto al token.

L'SDK Owlbear 3.1 non espone API per il dado 3D della piattaforma: i tiri usano
il generatore crittografico del browser e le API Owlbear disponibili
(`broadcast`, `notification`, `scene.items`).

## Boardown

La roadmap vive in `.boardown/` e si gestisce con la CLI inclusa tra le
dipendenze di sviluppo:

```bash
pnpm exec boardown release list
pnpm exec boardown backlog
pnpm exec boardown task get TE-9
```

La GitHub Action esegue build, lint e test su ogni push a `main` e sulle pull
request. Il progetto Vercel collegato a GitHub pubblica automaticamente i push
su `main`.

## Limiti della versione 0.5

- L'importatore richiede il blocco `normalized` di `roll20-sheet-export`.
- Le formule ricavate dalle descrizioni vengono segnalate nelle note d'import.
- I tiri non sono renderizzati come dadi 3D: l'SDK non espone il dado di Owlbear.
- L'SDK non permette di creare cartelle di asset: i token del bestiario usano il
  prefisso `beasts/` nel nome, non una cartella reale.
- Le schede condivise vivono nei metadata della stanza: se la stanza viene
  eliminata restano solo le copie locali dei rispettivi proprietari.
- Le note condivise sono leggibili da tutti i partecipanti della stanza. Per
  dati riservati al GM usare l'invio cifrato della copia. I permessi di scrittura
  sono controllati dall'interfaccia, secondo i limiti dei metadata Owlbear.
- I permessi di modifica sono applicati dall'interfaccia. I metadata della stanza
  sono scrivibili da ogni client collegato e l'SDK non offre controlli per
  chiave: proteggono dalle modifiche accidentali, non da un client ostile.
- Lo storico non viene recuperato da chi entra nella stanza dopo l'invio.
