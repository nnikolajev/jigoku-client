// EXPERIMENTAL: turns the whole game log into the rows the History popup renders.
//
// This is a FULL history: every non-chat log entry becomes a row, so keyword payoffs
// (Courtesy, Sincerity), ring effects, duels, honor bids and skill announcements all
// appear, not only the entries that happen to carry a play verb. Rows are classified
// so the popup can style them:
//
//   "phase"    from Phase.ts, which opens every phase with
//              addAlert('endofround', 'Round {0} - {1} phase', roundNumber, name)
//   "conflict" from conflictflow.ts, '{0} is initiating a {1} conflict at {2},
//              contesting {3}' -- enriched with the participants recorded by
//              conflictLedger.ts, which the log itself never names
//   "play"     everything parseSpotlightEvent recognises (a play verb + a source card)
//   "note"     any other entry that mentions at least one card -- it gets art
//   "text"     everything else, rendered as a plain line

import { mergeTargets, parseSpotlightEvent, parseTargetContinuation } from "./cardPlaySpotlight";
import {
    alertOf,
    conflictDeclarationIndex,
    flattenMessage,
    fragmentsText,
    fragmentToCard,
    isChatMessage,
    isRecordFragment,
    isStringFragment,
    recordOf
} from "./messageFragments";
import type { MessageRecord, RecordedCard } from "./messageFragments";
import type { SpotlightCard, SpotlightEvent } from "./cardPlaySpotlight";
import type { ConflictLedgerEntry } from "./conflictLedger";

export interface HistoryPhaseRow {
    kind: "phase";
    key: string;
    label: string;
}

export interface CovertPair {
    source: SpotlightCard | null;
    target: SpotlightCard;
}

export interface HistoryConflictRow {
    kind: "conflict";
    key: string;
    playerName: string;
    conflictType: string;
    province: SpotlightCard | null;
    ring: SpotlightCard | null;
    attackers: SpotlightCard[];
    defenders: SpotlightCard[];
    covert: CovertPair[];
    text: string;
}

export interface HistoryPlayRow {
    kind: "play";
    key: string;
    event: SpotlightEvent;
}

export interface HistoryNoteRow {
    kind: "note";
    key: string;
    cards: SpotlightCard[];
    text: string;
    alertType: string;
}

export interface HistoryTextRow {
    kind: "text";
    key: string;
    text: string;
    alertType: string;
}

export type HistoryRow =
    | HistoryPhaseRow
    | HistoryConflictRow
    | HistoryPlayRow
    | HistoryNoteRow
    | HistoryTextRow;

function fromRecordedCard(card: RecordedCard): SpotlightCard {
    return {
        uuid: card.uuid,
        id: card.id,
        name: card.name,
        packId: card.packId,
        type: card.type,
        element: card.element
    };
}

function fromRecordedCards(cards: RecordedCard[] | undefined): SpotlightCard[] {
    return (cards ?? []).map(fromRecordedCard);
}

function cardsIn(fragments: any[]): SpotlightCard[] {
    const seen = new Set<string>();
    const cards: SpotlightCard[] = [];
    for(const fragment of fragments) {
        const card = fragmentToCard(fragment);
        if(card && !seen.has(card.uuid)) {
            seen.add(card.uuid);
            cards.push(card);
        }
    }
    return cards;
}

// The engine never records WHICH covert attacker bypassed WHICH defender -- that
// pairing only ever exists in a prompt title ("Choose covert target for X"). What the
// board does publish is the set of covert-capable attackers and the set of bypassed
// defenders, so pair them when the counts line up and leave the source unattributed
// otherwise rather than inventing one.
function pairCovert(targets: SpotlightCard[], sources: SpotlightCard[]): CovertPair[] {
    if(targets.length === 0) {
        return [];
    }
    if(sources.length === 1) {
        return targets.map(target => ({ source: sources[0], target }));
    }
    if(sources.length === targets.length) {
        return targets.map((target, index) => ({ source: sources[index], target }));
    }
    return targets.map(target => ({ source: null, target }));
}

// The phase banner is the only 'endofround' alert the engine raises, and it is emitted
// at the START of each phase, so it doubles as the round marker.
function phaseRowFrom(message: any, key: string): HistoryPhaseRow | null {
    const alert = alertOf(message);
    if(!alert || alert.type !== "endofround") {
        return null;
    }
    const label = fragmentsText(flattenMessage(message));
    return label ? { kind: "phase", key, label } : null;
}

function conflictRowFrom(fragments: any[], key: string): HistoryConflictRow | null {
    const initiatingIndex = conflictDeclarationIndex(fragments);
    if(initiatingIndex < 0) {
        return null;
    }

    const player = fragments.find(fragment => isRecordFragment(fragment) && fragment.name && !fragment.id);
    const conflictType = fragments.find(
        (fragment, index) => index > initiatingIndex && isStringFragment(fragment) &&
            (fragment.trim() === "military" || fragment.trim() === "political")
    );

    const cards = cardsIn(fragments.slice(initiatingIndex));
    const ring = cards.find(card => card.type === "ring") ?? null;
    const province = cards.find(card => card.type !== "ring") ?? null;

    return {
        kind: "conflict",
        key,
        playerName: isRecordFragment(player) ? (player.name ?? "") : "",
        conflictType: isStringFragment(conflictType) ? conflictType.trim() : "",
        province,
        ring,
        attackers: [],
        defenders: [],
        covert: [],
        text: fragmentsText(fragments)
    };
}

export function buildGameHistory(messages: any[], ledger: ConflictLedgerEntry[] = []): HistoryRow[] {
    const rows: HistoryRow[] = [];
    let conflictIndex = 0;
    // Conflict rows built from server records are completed in place as the covert and
    // defender entries arrive later in the log.
    const recordedConflicts = new Map<number, HistoryConflictRow>();

    (messages || []).forEach((message, index) => {
        const key = `history-${index}`;
        const record = recordOf(message);

        // A recorded conflict needs no guesswork: the server names the participants, and
        // the covert pairing it publishes is the real one rather than a count match.
        if(record && record.kind === "conflict-declared") {
            const row: HistoryConflictRow = {
                kind: "conflict",
                key,
                playerName: record.player ?? "",
                conflictType: record.conflictType ?? "",
                province: record.province ? fromRecordedCard(record.province) : null,
                ring: record.ring ? fromRecordedCard(record.ring) : null,
                attackers: fromRecordedCards(record.attackers),
                defenders: [],
                covert: [],
                text: fragmentsText(flattenMessage(message))
            };
            if(record.conflictId !== undefined) {
                recordedConflicts.set(record.conflictId, row);
            }
            conflictIndex += 1;
            rows.push(row);
            return;
        }

        if(record && record.kind === "conflict-covert") {
            const row = record.conflictId === undefined ? undefined : recordedConflicts.get(record.conflictId);
            if(row) {
                row.covert = (record.covert ?? []).map(pair => ({
                    source: fromRecordedCard(pair.source),
                    target: fromRecordedCard(pair.target)
                }));
                return;
            }
        }

        if(record && record.kind === "conflict-defenders") {
            const row = record.conflictId === undefined ? undefined : recordedConflicts.get(record.conflictId);
            if(row) {
                row.defenders = fromRecordedCards(record.defenders);
                return;
            }
        }

        const phase = phaseRowFrom(message, key);
        if(phase) {
            rows.push(phase);
            return;
        }

        const fragments = flattenMessage(message);
        if(fragments.length === 0 || isChatMessage(fragments)) {
            return;
        }

        const conflict = conflictRowFrom(fragments, key);
        if(conflict) {
            // FALLBACK for a game recorded before the server emitted conflict records.
            // conflictLedger keys its entries on this same declaration count, so the
            // two line up without either side having to guess conflict boundaries.
            const entry = ledger[conflictIndex];
            conflictIndex += 1;
            rows.push(entry
                ? {
                    ...conflict,
                    attackers: entry.attackers,
                    defenders: entry.defenders,
                    covert: pairCovert(entry.covert, entry.covertSources)
                }
                : conflict);
            return;
        }

        const event = parseSpotlightEvent(message, key);
        if(event) {
            rows.push({ kind: "play", key, event });
            return;
        }

        // "{0} chooses to honor {1}" is where 76 cards record the target their own play
        // entry never names (Court Games, Asako Diplomat, ...). Fold it into the play it
        // belongs to instead of leaving a headless row, so the history shows
        // "Court Games -> Doji Whisperer" rather than two disconnected lines.
        const continuation = parseTargetContinuation(message);
        const previous = rows.length > 0 ? rows[rows.length - 1] : null;
        if(continuation.length > 0 && previous && previous.kind === "play") {
            rows[rows.length - 1] = {
                ...previous,
                event: {
                    ...previous.event,
                    targets: mergeTargets(previous.event.targets, continuation),
                    text: `${previous.event.text} — ${fragmentsText(fragments)}`
                }
            };
            return;
        }

        const text = fragmentsText(fragments);
        if(!text) {
            return;
        }
        const cards = cardsIn(fragments);
        const alertType = alertOf(message)?.type ?? "";
        rows.push(cards.length > 0
            ? { kind: "note", key, cards, text, alertType }
            : { kind: "text", key, text, alertType });
    });

    return rows;
}
