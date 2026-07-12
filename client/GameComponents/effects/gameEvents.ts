// Detects notable game events by diffing successive game states from the server.

function collectStringFragments(fragment: any, out: string[]): void {
    if(fragment === null || fragment === undefined) {
        return;
    }
    if(typeof fragment === "string") {
        out.push(fragment);
        return;
    }
    if(Array.isArray(fragment)) {
        for(const child of fragment) {
            collectStringFragments(child, out);
        }
        return;
    }
    if(typeof fragment === "object" && fragment.message) {
        collectStringFragments(fragment.message, out);
    }
}

function isChatMessage(message: any): boolean {
    const fragments = Array.isArray(message?.message) ? message.message : [];
    return fragments.some((fragment: any) => fragment && typeof fragment === "object" && fragment.emailHash);
}

// Game log entries for playing a card are all formatted as "{0} plays {1} ...".
// The server's GameChat.formatMessage splits literal text into single-word string
// fragments, so "plays" arrives as its own fragment. Chat messages keep the player's
// text as one untouched string, so an exact-word match cannot hit chat content.
export function isCardPlayMessage(message: any): boolean {
    if(isChatMessage(message)) {
        return false;
    }
    const strings: string[] = [];
    collectStringFragments(message?.message, strings);
    return strings.some(text => text === "plays" || / plays /.test(text));
}

export function countCardPlayMessages(messages: any[]): number {
    return messages.reduce((count, message) => count + (isCardPlayMessage(message) ? 1 : 0), 0);
}

export interface ConflictResolution {
    type: string;
    winnerSkill: number;
}

// A conflict summary disappearing from the game state means the conflict just resolved.
// The last summary seen still carries the final skill totals.
export function detectConflictResolution(prevGame: any, currentGame: any): ConflictResolution | null {
    const prevConflict = prevGame?.conflict;
    if(!prevConflict || currentGame?.conflict) {
        return null;
    }
    if(!prevConflict.declarationComplete) {
        return null;
    }

    return {
        type: prevConflict.type,
        winnerSkill: Math.max(prevConflict.attackerSkill || 0, prevConflict.defenderSkill || 0)
    };
}
