// EXPERIMENTAL: detects "X plays/uses <card> to <effect> <target>" entries as they
// arrive in the game log, so the board can show what was played and what it hit.
//
// The server already gives us everything we need. CardAbility.displayMessage emits
// '{0}{1}{2}...' with args [player, ' uses ', source, ..., ' to ', effectMessage],
// and GameChat.formatMessage turns every card arg into a fragment carrying
// { id, uuid, name, packId, type } -- the same fragment Messages.tsx already uses to
// highlight a board card by document.getElementById(uuid). So the source card, its
// targets and their board positions are all recoverable client-side with no server
// change.

import {
    flattenMessage,
    fragmentsText,
    fragmentToCard,
    isChatMessage,
    isRecordFragment,
    isStringFragment,
    isTargetContinuation,
    recordOf
} from "./messageFragments";
import type { RecordedCard } from "./messageFragments";

export interface SpotlightCard {
    uuid: string;
    id: string;
    name: string;
    packId?: string;
    type: string;
    element?: string;
    facedown?: boolean;
}

export interface SpotlightEvent {
    key: string;
    verb: string;
    playerName: string;
    source: SpotlightCard;
    targets: SpotlightCard[];
    cancels: boolean;
    text: string;
}

// "resolves" matters: an ability resolved a second time (Banzai paying an honor to
// repeat itself) comes back through ResolveAbilityAction, which calls
// displayMessage(context, 'resolves') rather than the usual 'uses'.
const PLAY_VERBS = ["plays", "uses", "triggers", "initiates", "resolves"];

// A reconnect or a replay seek can replace the whole message list at once. Anything
// bigger than a normal server tick is treated as a resync and skipped, so the board
// does not fire twenty overlays in one frame.
const MAX_NEW_MESSAGES_PER_TICK = 6;

function findVerbIndex(fragments: any[]): number {
    return fragments.findIndex(fragment => {
        if(!isStringFragment(fragment)) {
            return false;
        }
        return PLAY_VERBS.includes(fragment.trim());
    });
}

function playerNameOf(fragments: any[]): string {
    const named = fragments.find(fragment => isRecordFragment(fragment) && fragment.name && !fragment.id);
    return named ? (named.name ?? "") : "";
}

function toSpotlightCard(card: RecordedCard): SpotlightCard {
    return {
        uuid: card.uuid,
        id: card.id,
        name: card.name,
        packId: card.packId,
        type: card.type,
        element: card.element
    };
}

// The server-side record, when the server is new enough to send one. It names the source
// and the targets outright, so it covers abilities whose message follows no fixed shape
// -- ring effects, province reveals, duels, anything with a custom properties.message --
// which the verb heuristic below can never read.
function eventFromRecord(message: any, key: string): SpotlightEvent | null {
    const record = recordOf(message);
    if(!record || record.kind !== "play" || !record.source) {
        return null;
    }
    const text = fragmentsText(flattenMessage(message));
    return {
        key,
        verb: record.verb ?? "plays",
        playerName: record.player ?? "",
        source: toSpotlightCard(record.source),
        targets: (record.targets ?? []).map(toSpotlightCard),
        cancels: /\bcancel/i.test(text),
        text
    };
}

export function parseSpotlightEvent(message: any, key: string): SpotlightEvent | null {
    const recorded = eventFromRecord(message, key);
    if(recorded) {
        return recorded;
    }

    const fragments = flattenMessage(message);
    if(fragments.length === 0 || isChatMessage(fragments)) {
        return null;
    }

    const verbIndex = findVerbIndex(fragments);
    if(verbIndex < 0) {
        return null;
    }

    const sourceIndex = fragments.findIndex((fragment, index) => index > verbIndex && !!fragmentToCard(fragment));
    if(sourceIndex < 0) {
        return null;
    }

    const source = fragmentToCard(fragments[sourceIndex]);
    if(!source) {
        return null;
    }

    const seen = new Set<string>([source.uuid]);
    const targets: SpotlightCard[] = [];
    for(let index = sourceIndex + 1; index < fragments.length; index++) {
        const card = fragmentToCard(fragments[index]);
        if(!card || seen.has(card.uuid)) {
            continue;
        }
        seen.add(card.uuid);
        targets.push(card);
    }

    const text = fragmentsText(fragments);
    return {
        key,
        verb: fragments[verbIndex].trim(),
        playerName: playerNameOf(fragments),
        source,
        targets,
        cancels: /\bcancel/i.test(text),
        text
    };
}

export function mergeTargets(existing: SpotlightCard[], incoming: SpotlightCard[]): SpotlightCard[] {
    if(incoming.length === 0) {
        return existing;
    }
    const seen = new Set(existing.map(card => card.uuid));
    const added = incoming.filter(card => !seen.has(card.uuid));
    return added.length === 0 ? existing : [...existing, ...added];
}

// The cards named by a "{0} chooses to honor {1}" follow-up, which is where 76 cards
// record the target that their own play entry does not name. Returns [] for anything
// that is a play in its own right, so a play entry is never also read as a follow-up.
// A "{0} chooses to honor {1}" follow-up. The server records these as kind "target",
// naming both the ability's source and the cards chosen; without a record the client
// falls back to spotting the `chooses` verb and taking whatever cards the entry names.
export function parseTargetContinuation(message: any): SpotlightCard[] {
    const record = recordOf(message);
    if(record) {
        return record.kind === "target" ? (record.targets ?? []).map(toSpotlightCard) : [];
    }

    const fragments = flattenMessage(message);
    if(fragments.length === 0 || isChatMessage(fragments) || !isTargetContinuation(fragments)) {
        return [];
    }
    if(parseSpotlightEvent(message, "probe")) {
        return [];
    }

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

// Every target named by follow-up entries appended since the previous game state.
export function detectNewTargetContinuations(prevMessages: any[], currentMessages: any[]): SpotlightCard[] {
    const previousCount = prevMessages?.length || 0;
    const currentCount = currentMessages?.length || 0;
    const added = currentCount - previousCount;
    if(added <= 0 || added > MAX_NEW_MESSAGES_PER_TICK) {
        return [];
    }

    let cards: SpotlightCard[] = [];
    for(let index = previousCount; index < currentCount; index++) {
        cards = mergeTargets(cards, parseTargetContinuation(currentMessages[index]));
    }
    return cards;
}

// Returns the spotlight events for messages appended since the previous game state.
export function detectNewSpotlightEvents(prevMessages: any[], currentMessages: any[], sequence: number): SpotlightEvent[] {
    const previousCount = prevMessages?.length || 0;
    const currentCount = currentMessages?.length || 0;
    const added = currentCount - previousCount;
    if(added <= 0 || added > MAX_NEW_MESSAGES_PER_TICK) {
        return [];
    }

    const events: SpotlightEvent[] = [];
    for(let index = previousCount; index < currentCount; index++) {
        const event = parseSpotlightEvent(currentMessages[index], `spotlight-${sequence}-${index}`);
        if(event) {
            events.push(event);
        }
    }
    return events;
}
