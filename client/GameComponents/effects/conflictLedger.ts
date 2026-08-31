// EXPERIMENTAL: records who took part in each conflict, for the History popup.
//
// The log never names the participants -- conflictflow.ts messages the declaration,
// the skills and the winner, but never the bodies -- so the client watches the board
// instead.
//
// Entries are keyed on HOW MANY conflict declarations the log holds, not on conflict
// boundaries. That matters: conflictflow.ts calls updateCurrentConflict(null) twice in
// the middle of a conflict (lines 202 and 300), so the state publishes `conflict: {}`
// while the conflict is still running. Keying off "the conflict ended" split one
// conflict across several entries and knocked the history out of alignment; keying off
// the declaration count cannot, because buildGameHistory counts declarations the same
// way.
//
// Everything is accumulated as a union rather than overwritten, because the board only
// shows the truth for an instant:
//   * covert is cleared on every one of the defender's cards the moment defenders are
//     declared (conflictflow.ts), so it has to survive the read that follows,
//   * attackers arrive after declaration (a body played into the conflict, a move
//     source) and can leave again.

import type { SpotlightCard } from "./cardPlaySpotlight";

export interface ConflictLedgerEntry {
    attackers: SpotlightCard[];
    defenders: SpotlightCard[];
    // The defender's characters that were bypassed by covert.
    covert: SpotlightCard[];
    // The attacking characters holding the covert keyword, which is as close as the
    // published state gets to naming who spent it -- the pairing itself only ever
    // exists in a prompt title.
    covertSources: SpotlightCard[];
}

function emptyEntry(): ConflictLedgerEntry {
    return { attackers: [], defenders: [], covert: [], covertSources: [] };
}

function toCard(card: any): SpotlightCard {
    return {
        uuid: card.uuid,
        id: card.id,
        name: card.name,
        packId: card.packId,
        type: card.type,
        facedown: !!card.facedown
    };
}

function playerById(game: any, id: string): any | null {
    const players: any[] = Object.values(game?.players || {});
    return players.find((player: any) => player?.id === id) ?? null;
}

function cardsInPlay(player: any): any[] {
    return player?.cardPiles?.cardsInPlay || [];
}

function union(existing: SpotlightCard[], incoming: SpotlightCard[]): SpotlightCard[] {
    if(incoming.length === 0) {
        return existing;
    }
    const seen = new Set(existing.map(card => card.uuid));
    const added = incoming.filter(card => !seen.has(card.uuid));
    return added.length === 0 ? existing : [...existing, ...added];
}

function sameCards(a: SpotlightCard[], b: SpotlightCard[]): boolean {
    return a.length === b.length && a.every((card, index) => card.uuid === b[index].uuid);
}

// Folds one game state into the ledger, returning a new array when something was
// recorded and the same array when nothing changed.
//
// `declarationCount` is supplied by the caller rather than counted here: the count only
// ever changes when a message is appended, so walking the whole log on every state tick
// (269 ticks against 535 messages in a measured game) was pure waste. GameBoard counts
// the new tail instead.
export function recordConflictState(
    ledger: ConflictLedgerEntry[],
    game: any,
    declarationCount: number
): ConflictLedgerEntry[] {
    // A replay can seek BACKWARDS, which drops the log below what has been recorded.
    // Entries past the new count describe conflicts that have not happened yet at this
    // point in the replay, so they go.
    const scoped = ledger.length > declarationCount ? ledger.slice(0, declarationCount) : ledger;

    const conflict = game?.conflict;
    if(!conflict || !conflict.declarationComplete) {
        return scoped;
    }

    const attackingPlayer = playerById(game, conflict.attackingPlayerId);
    if(!attackingPlayer) {
        return scoped;
    }
    const defendingPlayer = playerById(game, conflict.defendingPlayerId);

    const index = declarationCount - 1;
    if(index < 0) {
        return scoped;
    }

    const attackerCards = cardsInPlay(attackingPlayer);
    const defenderCards = cardsInPlay(defendingPlayer);
    const attackers = attackerCards.filter((card: any) => card?.inConflict && card.uuid).map(toCard);
    const defenders = defenderCards.filter((card: any) => card?.inConflict && card.uuid).map(toCard);
    // `card.covert` means this card HAS BEEN covert-ed; the keyword itself is published
    // separately as `hasCovert`.
    const covert = defenderCards.filter((card: any) => card?.covert && card.uuid).map(toCard);
    const covertSources = attackers.length > 0
        ? attackerCards.filter((card: any) => card?.hasCovert && card.inConflict && card.uuid).map(toCard)
        : [];

    const existing = scoped[index] ?? emptyEntry();
    const merged: ConflictLedgerEntry = {
        attackers: union(existing.attackers, attackers),
        defenders: union(existing.defenders, defenders),
        covert: union(existing.covert, covert),
        covertSources: union(existing.covertSources, covertSources)
    };

    if(scoped[index] &&
        sameCards(merged.attackers, existing.attackers) &&
        sameCards(merged.defenders, existing.defenders) &&
        sameCards(merged.covert, existing.covert) &&
        sameCards(merged.covertSources, existing.covertSources)) {
        return scoped;
    }

    const next = [...scoped];
    while(next.length < index) {
        next.push(emptyEntry());
    }
    next[index] = merged;
    return next;
}
