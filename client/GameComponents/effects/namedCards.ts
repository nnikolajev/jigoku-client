// A card that has been NAMED -- by Gossip's menu, or by the nameCard() cost that Shiro
// Kitsuki and friends pay.
//
// Naming names a string, not a card object: there is no uuid to point at, and the named
// card need not be in either deck. The server resolves the printing when a copy exists
// somewhere in the game; otherwise the name is looked up in the card database the
// client already holds.

import { preferredPackId } from "../../cardImageUrl.js";

export interface NamedCardBadge {
    name: string;
    id?: string;
    packId?: string;
    sourceUuid?: string;
    sourceId?: string;
    sourceName?: string;
}

export interface ResolvedNamedCard {
    name: string;
    id?: string;
    packId?: string;
    sourceUuid?: string;
    sourceName?: string;
}

/** The slice of a card-database entry this module reads. */
export interface CardRecord {
    id: string;
    name: string;
    versions?: Array<{ pack_id: string }>;
}

/** The card database as the client holds it: every printable card, keyed by id. */
export type CardDatabase = Record<string, CardRecord>;

// The card database is ~10k entries and arrives once, so the name index is built on
// first use and kept against the identity of the object it was built from.
const nameIndexes = new WeakMap<CardDatabase, Map<string, CardRecord>>();

function nameIndex(cards: CardDatabase): Map<string, CardRecord> {
    const cached = nameIndexes.get(cards);
    if(cached) {
        return cached;
    }
    const index = new Map<string, CardRecord>();
    for(const card of Object.values(cards)) {
        if(card && card.name && !index.has(card.name)) {
            index.set(card.name, card);
        }
    }
    nameIndexes.set(cards, index);
    return index;
}

/**
 * Fill in the printing to draw. The server's answer wins -- it names the copy actually
 * in this game -- and the card database is the fallback for a name nobody brought.
 */
export function resolveNamedCard(
    badge: NamedCardBadge,
    cards: CardDatabase | undefined
): ResolvedNamedCard {
    const resolved: ResolvedNamedCard = {
        name: badge.name,
        id: badge.id,
        packId: badge.packId,
        sourceUuid: badge.sourceUuid,
        sourceName: badge.sourceName
    };
    if(resolved.id && resolved.packId) {
        return resolved;
    }
    if(!cards) {
        return resolved;
    }
    const match = nameIndex(cards).get(badge.name);
    if(!match) {
        return resolved;
    }
    resolved.id = resolved.id || match.id;
    // No format is plumbed into the game board, and this project targets Imperial, so
    // take the printing preferredPackId gives that format: the first version.
    resolved.packId = resolved.packId || preferredPackId(match, "stronghold");
    return resolved;
}

export function resolveNamedCards(
    badges: NamedCardBadge[] | undefined,
    cards: CardDatabase | undefined
): ResolvedNamedCard[] {
    if(!badges || badges.length === 0) {
        return [];
    }
    return badges.map(badge => resolveNamedCard(badge, cards));
}
