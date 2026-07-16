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

export interface ConflictProvinceBreak {
    type: string;
    skillDifference: number;
}

function collectProvinceBrokenState(game: any): Map<string, boolean> {
    const provinces = new Map<string, boolean>();
    for(const player of Object.values(game?.players || {}) as any[]) {
        const provincePiles = [
            ...Object.values(player?.provinces || {}),
            player?.strongholdProvince || []
        ];
        for(const pile of provincePiles as any[][]) {
            for(const card of pile || []) {
                if(card?.isProvince && card.uuid) {
                    provinces.set(card.uuid, !!card.isBroken);
                }
            }
        }
    }
    return provinces;
}

// Province cards become broken before any resulting reaction/discard prompt.
// Detect that exact transition so the effect does not wait for conflict cleanup.
export function detectConflictProvinceBreak(prevGame: any, currentGame: any): ConflictProvinceBreak | null {
    const previousProvinces = collectProvinceBrokenState(prevGame);
    const currentProvinces = collectProvinceBrokenState(currentGame);
    const provinceJustBroke = [...currentProvinces].some(
        ([uuid, isBroken]) => isBroken && previousProvinces.get(uuid) === false
    );
    if(!provinceJustBroke) {
        return null;
    }

    const currentConflict = currentGame?.conflict;
    const conflict = currentConflict && Object.keys(currentConflict).length > 0
        ? currentConflict
        : prevGame?.conflict;
    if(!conflict?.declarationComplete) {
        return null;
    }

    return {
        type: conflict.type,
        skillDifference: Math.abs((conflict.attackerSkill || 0) - (conflict.defenderSkill || 0))
    };
}
