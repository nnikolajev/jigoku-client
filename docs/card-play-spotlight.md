# Card play spotlight

Shows what card was just played and what it hit, instead of leaving that only in the
chat log — plus a marked-up conflict on the board and a full illustrated game history.

**On by default.** Game settings (the cog in the sidebar) → *Card play spotlight* → one
checkbox. The choice lives in `localStorage` under `jigoku.cardPlaySpotlightMode`, so it
is per browser, needs no server round trip, and carries across games. With it off the
detector is not called, and the conflict marks disappear with it. The **History** popup
is independent of the toggle and always available.

Three presentations were trialled (`rail`, an in-place `beam`, a stacked `ribbon`); the
rail shipped and the other two were removed. The ribbon's row styling lives on in the
History popup, which is where a stacked list actually earns its place. The stored value
is still the old mode string rather than a boolean, so a browser holding `"beam"` or
`"ribbon"` from the trial reads as on rather than as garbage — only an explicit `"off"`
disables it.

## Where the data comes from

The server attaches a **structured record** to the handful of log entries the client
needs to read precisely (`GameChat.MessageRecord`, shipped alongside `message` on the
same entry). Everything below about parsing the prose is the **fallback** for games
played against a server too old to emit one — the readers try the record first.

| Record | Emitted by | Carries |
| --- | --- | --- |
| `play` | `CardAbility.displayMessage` | player, verb, source, targets |
| `target` | `SelectCardAction`'s `onSelect` | the ability's source plus the cards chosen |
| `conflict-declared` | `conflictflow.initiateConflict` | conflictId, player, type, ring, province, attackers |
| `conflict-covert` | `conflictflow.resolveCovert` | conflictId, exact source → target pairs |
| `conflict-defenders` | `conflictflow.announceDefenderSkill` | conflictId, defenders |

`Game.addRecordedMessage(record, message, …args)` adds the message through
`Game.addMessage` and then `GameChat.attachRecord`s the record to it, so the hundreds of
existing `addMessage` call sites are untouched and anything spying on `addMessage` still
sees the same call. A card is recorded as its `getShortSummary()` — the same shape the
client already renders from — and anything without one (a facedown province passed as
its slot name) records as absent rather than as a broken half-card.

Two things only the server could know are now logged rather than guessed:

- **`conflictId`** (`Game.conflictSequence`, assigned at declaration) ties a conflict's
  three records together, so the History popup needs neither conflict-boundary detection
  nor declaration counting.
- **The covert pairing.** Which attacker bypassed which defender previously existed only
  in a prompt title and was never written to the log at all. `resolveCovert` now emits
  "X uses covert on Y" *and* the exact pairs.

### The prose fallback

`CardAbility.displayMessage` (jigoku
`server/game/CardAbility.ts`) already emits every play and every triggered ability as
one log entry built from `'{0}{1}{2}{3}{4}{5}{6}{7}{8}'` with the args

```
[player, ' uses ', source, gainedAbility, origin, costs…, ' to ', effectMessage]
```

and `GameChat.formatMessage` turns each card arg into a fragment carrying
`{ id, uuid, name, packId, type }`. So:

- **source** = the first card fragment after the verb fragment (`plays` / `uses` /
  `triggers` / `initiates` / `resolves` — an ability repeated by paying a cost, such as
  Banzai's second +2, comes back through `ResolveAbilityAction`, which calls
  `displayMessage(context, 'resolves')`, so leaving that verb out silently dropped every
  repeat resolution),
- **targets** = every later card fragment, deduped, minus the source,
- **amounts** — numbers are their own fragments, so the text builder must keep
  non-strings or "plays X at home with 2 additional fate" loses its 2,
- **board position** = `document.getElementById(uuid)` — play-area cards, provinces and
  attachments all render with `id={card.uuid}`, which is the same handle `Messages.tsx`
  uses to highlight a card from the log. Rings have no id and fall back to their
  `.ring.icon-element-<element>` class.

**A card whose target is chosen in a follow-up prompt names it in a SEPARATE log
entry.** `selectCard` takes its own `message`, and 76 cards in the pool use the shape
`'{0} chooses to honor {1}'` (Court Games, Asako Diplomat, Kitsuki Investigator, The
Perfect Gift…). Read independently the play entry has no target and the follow-up has no
source, which is why Court Games drew a rail card with no arrow.
`parseTargetContinuation` recognises the follow-up by its `chooses` verb plus at least
one card fragment (and returns nothing for an entry that is a play in its own right, so
the two can never both match). The rail merges those cards into the live entry — and
**re-shows an entry whose overlay already faded**, because the prompt that picks the
target can take a human longer than the 3s window. The history folds the follow-up into
the preceding play row instead of leaving a headless note.

A cancel is detected from the effect text (`cancel the effects of {0}` in
`CancelAction.getEffectMessage`), and the cancelled card comes through as the target.

Two guards matter: chat messages are excluded (only they carry an `emailHash` fragment,
so a player typing "he uses that a lot" cannot light up the board), and a tick that
appends more than `MAX_NEW_MESSAGES_PER_TICK` entries is treated as a reconnect resync
and skipped rather than fired one overlay per entry.

## The rail

The played card slides in at the right edge with a curved arrow to each target still on
the board; newer entries stack over older ones, and a cancel points at the rail card
below it.

**One entry per source card.** A card played and then given its target in a separate log
entry is one thing happening, so the second entry merges its targets into the entry
already showing that card instead of stacking a duplicate. Merging never refreshes the
lifetime, so a stream of follow-ups cannot pin an entry on screen. This replaced an
earlier rule that attached any follow-up to whatever was played last: with no record
there is nothing in a follow-up naming its own ability, and every unrelated prompt
re-showed the last played card with a fresh arrow. A recorded follow-up names its source,
so it now arrives as an ordinary event and lands on the right card; the positional
attachment survives only as the no-record fallback, and only onto an entry still on
screen. Entries hold for `SPOTLIGHT_DURATION_MS` (3s — the CSS fade-out delays must be
kept in step with it), cap at `SPOTLIGHT_MAX_VISIBLE` (3) simultaneous entries, are
`pointer-events: none` so they never eat a click, and collapse to a plain fade under
`prefers-reduced-motion`.

The rail sits to the **left** of the hover zoom pane. `.card-large` is a hard 338px
pinned to the right edge with no responsive rule of its own, so the gutter cannot shrink
— on a narrow window `railMetrics` shrinks the **cards** instead (154px at ≥1600, 132px
at ≥1280, 112px below).

## Conflict emphasis

Live whenever the spotlight is on — `GameBoard` puts `spotlight-active` on the board
root and the ring pulse is scoped under it, so turning the feature off removes it.

- **Ring pulse.** `Ring.tsx` already puts `.contested` on the contested ring's SVG
  (`ring.selected || ring.contested`); the pulse is a keyframe on that existing class.
- **Participation marks** (`ConflictArrows.tsx`). Each participating character gets a
  swept arrow — an arc with a chevron head at its apex — on the card edge that faces the
  enemy, red for attackers and blue for defenders, flipped 180° for the board half at the
  top of the screen. `viewerPlayerName` is what says which half is which.
  **Their React key must not include the anchor tick.** A changed key remounts the
  element, which replays its entry animation — at a 250ms re-measure tick that reads as a
  permanent pulse. Position comes from `style`; the key is the card uuid.
The overlay sits at `z-index: 60` — above the board cards (`--layer-cards: 45`) and pile
headers (55), below the card collection (100), the prompt (110), card menus (120), the
chat (800) and the draggable hand (`.player-home-row-container`, 1030). It was drawing
over the player's own hand at 1150.

- **Province marker.** Crossed swords over the contested province on a dark radial disc
  (needed to stay readable over card art), switching to a skull once `conflict.breaking`
  is true — the engine already computes that as "some conflict province's strength minus
  the skill difference is ≤ 0".

The conflict summary names no participants, but it does not have to: every participating
card and the contested province publish `inConflict` (set in `conflictflow.ts`), and the
summary publishes `attackingPlayerId` / `defendingPlayerId` against each player's own
`id`, so a character's side is its controller's side. Anchors are re-measured on a 250ms
poll because characters bow and move for the whole life of a conflict.

## History popup

The `History` button in the sidebar controls opens a scrollable, illustrated record of
the whole game (`GameHistory.tsx` + `gameHistory.ts`). It opens **scrolled to the newest
entry**, closes on Escape, on the close button and on the backdrop, and keeps Tab inside
the dialog.

**Hovering any card in it drives the board's own zoom pane.** The popup is laid out to
the left of that pane (`--game-history-zoom-gutter`) and `GameBoard` raises `.right-side`
above the popup's backdrop while it is open. `.right-side` sets its own `z-index` and
therefore its own stacking context, so the pane cannot be raised without its siblings
coming along — the chat and controls are switched to `pointer-events: none` for the
duration so they do not stay clickable behind a modal.

It is a FULL history — every non-chat log entry becomes a row, so keyword payoffs
(Courtesy, Sincerity), ring effects, skill announcements and honor bids all appear.
Rows are classified so they can be styled:

| Kind | Source | Rendering |
| --- | --- | --- |
| `phase` | `Phase.ts` opens every phase with `addAlert('endofround', 'Round {0} - {1} phase', …)`, so one alert gives both the round and the phase separator | banner |
| `conflict` | `'{0} is initiating a {1} conflict at {2}, contesting {3}'` | ring + province art, red for military / blue for political, plus the participants below |
| `play` | anything `parseSpotlightEvent` recognises | source art → target art |
| `note` | any other entry mentioning at least one card | card art + the log line |
| `text` | everything else | plain line, tinted by alert type |

Player chat is excluded (it is the only thing carrying an `emailHash` fragment).

### Conflict participants

The log never names who attacked, who defended or who was covert-ed, so
`conflictLedger.ts` watches the board instead.

- **Entries are keyed on the declaration COUNT, never on conflict boundaries.**
  `buildGameHistory` counts declaration messages the same way, so the two line up by
  construction. Boundaries cannot be used: `defendersChosen` is only ever set by
  `SelectDefendersPrompt`, so an undefended conflict never sets it — and
  `conflictflow.ts` calls `updateCurrentConflict(null)` twice *in the middle of* a
  conflict (lines 202 and 300), so the state publishes `conflict: {}` while the conflict
  is still running. Closing on that split one conflict across several entries and knocked
  every participant list off by one, which is what made them vanish from the popup.
- **The count is advanced, not recomputed.** `advanceDeclarationTally` reads only the
  messages that arrived; walking the whole log every tick was 269 ticks × 535 messages of
  pure waste in a measured game. A log that SHRANK means a replay seeking backwards (or a
  new game) and is recounted from scratch — and `recordConflictState` drops ledger
  entries past the new count, so scrubbing a replay backwards cannot leave a conflict
  recorded that has not happened yet.
- **Everything accumulates as a union, never an overwrite.** The board only shows the
  truth for an instant: `conflictflow.ts` clears `covert` on every one of the defender's
  cards the moment defenders are declared, and attackers arrive after declaration (a body
  played into the conflict, a move source). (`card.covert` means the card HAS BEEN
  covert-ed; the keyword itself is published separately as `hasCovert`.)
- **The covert pairing is a best effort.** Which attacker bypassed which defender exists
  only in a prompt title (`Choose covert target for X`) and is never logged or published.
  The ledger records the covert-capable attackers (`hasCovert` + participating) as
  `covertSources`; the popup pairs them 1:1 when there is a single source or the counts
  match, and shows the target with no source otherwise rather than inventing one.

## Collapsible controls bar

The sidebar controls sit over the play area, so they collapse to a single chevron handle
at the right edge (`.controls--collapsed`). It **ships collapsed** and remembers the
choice in `localStorage` under `jigoku.controlsExpanded` — only an explicit `"true"`
expands it. The chat below is a separate control and is deliberately left alone.

The buttons stay mounted while collapsed so the bar can slide, which would otherwise
leave hidden buttons in the tab order — the wrapper carries `inert` instead (React 19).
Every button also carries an `aria-label`: below 1366px `Controls` drops its text labels,
so without one an icon button has no accessible name at all, and its own tests had to
address buttons by index.

## Stat deltas

Fate and honor already floated a green `+N` / red `-N` on change (`StatDelta` +
`stat-delta-host`). Hand size did not; it does now, in both `PlayerStatsBox` and
`PlayerStatsRow`.

## Files

- `client/GameComponents/effects/messageFragments.ts` — shared reading of the log's
  message fragments (flatten, text, card, alert, chat and declaration detection). The
  spotlight, the history and the ledger all start here.
- `client/GameComponents/effects/cardPlaySpotlight.ts` — log parsing.
- `client/GameComponents/effects/spotlightAnchors.ts` — uuid → live board rect, plus the
  re-measure tick that survives relayout and scrolling.
- `client/GameComponents/effects/CardPlaySpotlight.tsx` — the on/off gate and the
  `localStorage` preference.
- `client/GameComponents/effects/SpotlightRail.tsx` — the overlay.
- `client/GameComponents/effects/ConflictArrows.tsx` — participation marks and the
  province sword/skull.
- `client/GameComponents/effects/conflictLedger.ts` — who took part in each conflict.
- `client/GameComponents/effects/gameHistory.ts` — log → history rows.
- `client/GameComponents/effects/GameHistory.tsx` — the popup.
- `client/css/gameboard/card-play-spotlight.css`.
- Wired in `GameBoard.tsx` (`collectSpotlightEvents`, called from `playGameEffects`),
  `GameComponents/GameConfiguration.tsx` (the checkbox) and `GameComponents/Controls.tsx`
  (the History button).

Tests live in `test/client/GameComponents/effects/`: `messageFragments`,
`cardPlaySpotlight`, `conflictLedger` and `gameHistory` cover the pure parsing and
folding; `SpotlightRail`, `ConflictArrows` and `GameHistory` render the components. The
DOM-anchored overlays need `getBoundingClientRect` stubbed — jsdom reports every element
as zero-sized, which `anchorFor` correctly reads as "not on screen".

## Known gaps

**Only against an older server.** Everything below is a limitation of the prose
fallback; with records present none of it applies.

- The **ledger does not survive a reload** — it is built by watching live state, so
  conflicts from before a refresh come back with no attacker/defender/covert rows. The
  rest of the history is rebuilt from the log and is unaffected.
- **Verb coverage in the rail**: only `plays` / `uses` / `triggers` / `initiates` /
  `resolves` open an overlay (`chooses` attaches targets to one, it does not open one).
  Ring effects, province reveals and duel resolution use a custom `properties.message`
  with no verb at all, so they are silent on the board — they do appear in the History
  popup, as `note` rows.
- The **covert pairing** is a count match rather than the real one.

`conflictLedger.ts` and the declaration-count keying exist only to serve that fallback.
They can be deleted once no game old enough to need them is worth reading.
