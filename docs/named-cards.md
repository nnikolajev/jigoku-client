# Named cards on the board

Two abilities name a card out loud and then keep mattering for a while, with nothing on
the board to show for it:

- **Shiro Kitsuki** names a card at conflict declaration and claims a ring every time the
  opponent plays it, for the rest of that conflict.
- **Gossip** (and Bayushi's Whisperers, Esteemed Tea House, Dai Tsuchi) names a card the
  opponent cannot play copies of, for the rest of the phase.

Before this, the only trace was one line in the chat log. This feature draws the named
card where the rule is felt.

## The shape of the problem

A named card is a **string**, not a card object. There is no uuid to point at, and the
named card need not be in either deck — so nothing in the existing serialized state can
carry it, and the client cannot derive it from the board.

Both facts also have to expire *exactly* when the rule does. That rules out remembering
the log line: the client would have to model each card's duration itself.

## How the server publishes it

Both are read off the **live effect** in `server/game/NamedCardState.ts`, so a badge
exists precisely as long as the effect exists.

- `unplayableNamedCards(game, player)` scans for an active `AbilityRestrictions` effect
  whose `Restriction` is `copiesOfX`, and reports it against every player in the
  effect's `targets`. All four "cannot play copies of X" cards are covered with no
  per-card code.
- `namedCardsForPlayer(game, player)` scans for effects carrying a `namedCard`, and
  reports them against the controller of the card that named it.

`namedCard` gets onto the effect via `captureNamedCard`, called from the three
`LastingEffect*Action.eventHandler`s. It has to be copied there rather than read later,
because **`Effect.refreshContext()` replaces the effect's context with a fresh framework
one** — `context.costs.nameCardCost`, where the `nameCard()` cost puts its answer, is
gone by the time the effect reaches the engine.

Each badge also carries the printing to draw. `findPrinting` looks the name up in
`game.allCards`, so the picture is the copy actually in this game. A name nobody brought
resolves to nothing here, and the client falls back to its own card database.

Published as `namedCards` and `cannotPlayNamed` on the player state, both omitted when
empty.

## How the client draws it

`client/GameComponents/effects/namedCards.ts` fills in a missing printing from the card
database the client already holds, indexed by name on first use and cached against the
identity of the database object. No format is plumbed into the game board and this
project targets Imperial, so the fallback takes `preferredPackId(card, "stronghold")` —
the first printing.

- `NamedCardMarkers.tsx` pins the named card beside the card that named it, anchored to
  that card's own `id={card.uuid}` DOM node — the same handle the spotlight arrows use,
  so it follows the stronghold wherever the layout puts it. It sits at `z-index: 60`,
  the conflict-arrow layer: over the board cards, under the hand, prompt, menus and
  chat. An unanchorable or unresolvable entry draws nothing rather than floating over
  the board.
- `BlockedCards.tsx` renders in the sidebar strip of the player who **cannot play** the
  card, against their nameplate — top of the pane for the opponent, bottom for you,
  since the two nameplates sit at opposite ends of the sidebar grid. The art is drained
  and a cancel mark drawn over it.

## Tests

Server: `test/server/cards/08-MotC/Gossip.spec.js` and
`test/server/cards/09.5-aCF/ShiroKitsuki.spec.js` each assert the badge is published
with the right printing **and that it disappears** when the phase / conflict ends. The
expiry half is the one worth keeping — it is what proves the badge is tied to the effect
rather than to the log.

Client: `namedCards.spec.ts` covers resolution and its fallbacks;
`BlockedCards.spec.tsx` and `NamedCardMarkers.spec.tsx` render the components. The
anchored overlay needs `getBoundingClientRect` stubbed — jsdom reports every element as
zero-sized, which the anchor correctly reads as "not on screen".

## Scope

`captureNamedCard` covers every card that pays the `nameCard()` cost and applies a
lasting effect (Shiro Kitsuki, Ashalan Lantern). Kitsuki Chiari and Honest Assessment
name a card and resolve immediately, so they have no window to show a badge in — the
mechanism is generic, those two simply never light it up.
