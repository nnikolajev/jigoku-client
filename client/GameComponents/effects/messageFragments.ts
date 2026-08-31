// EXPERIMENTAL: shared reading of the game log's message fragments.
//
// GameChat.formatMessage flattens a format string into an array where literal text is
// split into single words, every card argument becomes an object carrying
// { id, uuid, name, packId, type }, and nested messages (effect text, cost text) are
// wrapped as { message: [...] }. Alerts are pushed as { alert: { type, message } }.
// Everything that reads the log -- the spotlight, the history, the conflict ledger --
// starts from these helpers.

import type { SpotlightCard } from "./cardPlaySpotlight";

export interface MessageFragment {
    alert?: { type?: string; message?: any };
    element?: string;
    emailHash?: string;
    facedown?: boolean;
    id?: string;
    message?: any;
    name?: string;
    packId?: string;
    type?: string;
    uuid?: string;
}

// The structured companion the server now attaches to the entries the client needs to
// read precisely (GameChat.MessageRecord). Present only on games played against a
// server new enough to emit it, so every reader keeps its prose fallback.
export interface RecordedCard {
    id: string;
    name: string;
    uuid: string;
    type: string;
    packId?: string;
    element?: string;
}

export interface CovertBypass {
    source: RecordedCard;
    target: RecordedCard;
}

export interface MessageRecord {
    kind: "play" | "target" | "conflict-declared" | "conflict-covert" | "conflict-defenders";
    player?: string;
    verb?: string;
    source?: RecordedCard;
    targets?: RecordedCard[];
    conflictId?: number;
    conflictType?: string;
    ring?: RecordedCard;
    province?: RecordedCard;
    attackers?: RecordedCard[];
    defenders?: RecordedCard[];
    covert?: CovertBypass[];
}

export function recordOf(message: any): MessageRecord | null {
    const record = message?.record;
    return record && record.kind ? record : null;
}

export function isStringFragment(fragment: any): fragment is string {
    return typeof fragment === "string";
}

export function isRecordFragment(fragment: any): fragment is MessageFragment {
    return typeof fragment === "object" && fragment !== null;
}

export function alertOf(message: any): MessageFragment["alert"] | null {
    return isRecordFragment(message?.message) && !Array.isArray(message.message)
        ? (message.message.alert ?? null)
        : null;
}

function collect(fragment: any, out: any[]): void {
    if(fragment === null || fragment === undefined) {
        return;
    }
    if(Array.isArray(fragment)) {
        for(const child of fragment) {
            collect(child, out);
        }
        return;
    }
    if(isRecordFragment(fragment) && fragment.message && !fragment.id) {
        collect(fragment.message, out);
        return;
    }
    out.push(fragment);
}

// Every leaf of one log entry, in reading order. An alert's own text is unwrapped so
// callers see the same shape either way.
export function flattenMessage(message: any): any[] {
    const out: any[] = [];
    const alert = alertOf(message);
    collect(alert ? alert.message : message?.message, out);
    return out;
}

export function fragmentsText(fragments: any[]): string {
    return fragments
        .map(fragment => {
            if(isStringFragment(fragment)) {
                return fragment;
            }
            if(isRecordFragment(fragment)) {
                return fragment.name ?? "";
            }
            // Numbers are their own fragments; the amount in "with 2 additional fate"
            // is one of them, so anything non-string still has to be printed.
            return fragment === null || fragment === undefined ? "" : String(fragment);
        })
        .join("")
        .replace(/\s+/g, " ")
        .trim();
}

export function fragmentToCard(fragment: any): SpotlightCard | null {
    if(!isRecordFragment(fragment) || !fragment.id || !fragment.uuid || fragment.type === "player") {
        return null;
    }
    return {
        uuid: fragment.uuid,
        id: fragment.id,
        name: fragment.name ?? "",
        packId: fragment.packId,
        type: fragment.type ?? "",
        element: fragment.element,
        facedown: !!fragment.facedown
    };
}

// Player chat is the only thing carrying an emailHash fragment, so this is what keeps
// a player typing "he uses that a lot" out of the play overlays and the history.
export function isChatMessage(fragments: any[]): boolean {
    return fragments.some(fragment => isRecordFragment(fragment) && !!fragment.emailHash);
}

// A card whose target is picked in a follow-up prompt logs that target in its OWN
// entry, not in the play entry: selectCard takes a `message` of the shape
// '{0} chooses to honor {1}' and 76 cards in the pool use it (Court Games, Asako
// Diplomat, Kitsuki Investigator, The Perfect Gift...). Read on its own, such an entry
// has no source card and the play that opened it has no target, so both halves look
// empty. Callers pair them up instead.
export function isTargetContinuation(fragments: any[]): boolean {
    return fragments.some(fragment => isStringFragment(fragment) && fragment.trim() === "chooses");
}

// conflictflow.ts announces every declaration with
// '{0} is initiating a {1} conflict at {2}, contesting {3}'.
export function conflictDeclarationIndex(fragments: any[]): number {
    return fragments.findIndex(
        fragment => isStringFragment(fragment) && fragment.trim() === "initiating"
    );
}

// How many conflicts have been declared in the log so far. The conflict ledger keys its
// entries on this, and the history counts declarations the same way, so the two line up
// by construction instead of by guessing at conflict boundaries.
export function countConflictDeclarations(messages: any[], from = 0): number {
    let count = 0;
    const all = messages || [];
    for(let index = Math.max(0, from); index < all.length; index++) {
        const fragments = flattenMessage(all[index]);
        if(!isChatMessage(fragments) && conflictDeclarationIndex(fragments) >= 0) {
            count += 1;
        }
    }
    return count;
}

export interface DeclarationTally {
    count: number;
    scanned: number;
}

// The log is append-only, so the count only changes when a message arrives: advancing
// it means reading the new tail, not re-walking the whole log on every state tick. A
// log that SHRANK is a replay seeking backwards (or a fresh game), and is recounted
// from scratch.
export function advanceDeclarationTally(previous: DeclarationTally, messages: any[]): DeclarationTally {
    const total = (messages || []).length;
    if(total < previous.scanned) {
        return { count: countConflictDeclarations(messages), scanned: total };
    }
    if(total === previous.scanned) {
        return previous;
    }
    return {
        count: previous.count + countConflictDeclarations(messages, previous.scanned),
        scanned: total
    };
}
