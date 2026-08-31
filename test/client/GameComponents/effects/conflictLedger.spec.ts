import { describe, it, expect } from "vitest";
import { recordConflictState } from "../../../../client/GameComponents/effects/conflictLedger.js";

// The two board flags the ledger reads: `inConflict` (participating) and `covert`
// (this card HAS BEEN covert-ed). `hasCovert` is the keyword itself.
interface CardFlags {
    covert?: boolean;
    hasCovert?: boolean;
    inConflict?: boolean;
}

function card(uuid: string, name: string, flags: CardFlags = {}) {
    return { uuid, id: name.toLowerCase().replace(/ /g, "-"), name, type: "character", ...flags };
}

function state({
    attackers = [],
    defenders = [],
    covertCards = [],
    declarationComplete = true,
    defendersChosen = false
}) {
    return {
        conflict: declarationComplete
            ? { declarationComplete, defendersChosen, attackingPlayerId: "p1", defendingPlayerId: "p2" }
            : {},
        players: {
            One: { id: "p1", name: "One", cardPiles: { cardsInPlay: attackers } },
            Two: { id: "p2", name: "Two", cardPiles: { cardsInPlay: [...defenders, ...covertCards] } }
        }
    };
}

const noConflict = { conflict: {}, players: {} };

const berserker = card("a1", "Matsu Berserker", { inConflict: true });
const prodigy = card("a2", "Ikoma Prodigy", { inConflict: true });
const shinobi = card("a3", "Shosuro Shinobi", { inConflict: true, hasCovert: true });
const whisperer = card("d1", "Doji Whisperer", { inConflict: true });
const coverted = card("c1", "Kakita Yoshi", { covert: true });

describe("recordConflictState", () => {
    it("records nothing before the attackers are declared", () => {
        expect(recordConflictState([], state({ attackers: [berserker], declarationComplete: false }), 1)).toEqual([]);
    });

    it("records the attackers and the covert targets", () => {
        const ledger = recordConflictState([], state({ attackers: [berserker], covertCards: [coverted] }), 1);
        expect(ledger).toHaveLength(1);
        expect(ledger[0].attackers.map(entry => entry.name)).toEqual(["Matsu Berserker"]);
        expect(ledger[0].covert.map(entry => entry.name)).toEqual(["Kakita Yoshi"]);
    });

    it("records the covert-capable attackers as the covert sources", () => {
        const ledger = recordConflictState([], state({ attackers: [berserker, shinobi], covertCards: [coverted] }), 1);
        expect(ledger[0].covertSources.map(entry => entry.name)).toEqual(["Shosuro Shinobi"]);
    });

    it("returns the same array when nothing changed", () => {
        const first = recordConflictState([], state({ attackers: [berserker] }), 1);
        expect(recordConflictState(first, state({ attackers: [berserker] }), 1)).toBe(first);
    });

    // A body played into the conflict, or moved in, joins after declaration.
    it("accumulates attackers that arrive after declaration", () => {
        const first = recordConflictState([], state({ attackers: [berserker] }), 1);
        const second = recordConflictState(first, state({ attackers: [berserker, prodigy] }), 1);
        expect(second).toHaveLength(1);
        expect(second[0].attackers.map(entry => entry.name)).toEqual(["Matsu Berserker", "Ikoma Prodigy"]);
    });

    it("adds the defenders to the same entry", () => {
        const first = recordConflictState([], state({ attackers: [berserker] }), 1);
        const second = recordConflictState(
            first,
            state({ attackers: [berserker], defenders: [whisperer], defendersChosen: true }),
            1
        );
        expect(second).toHaveLength(1);
        expect(second[0].defenders.map(entry => entry.name)).toEqual(["Doji Whisperer"]);
    });

    // conflictflow.ts clears `covert` on every one of the defender's cards the moment
    // defenders are declared, so a plain overwrite would lose it.
    it("keeps covert after the engine clears the flag", () => {
        const first = recordConflictState([], state({ attackers: [berserker], covertCards: [coverted] }), 1);
        const second = recordConflictState(
            first,
            state({ attackers: [berserker], defenders: [whisperer], defendersChosen: true }),
            1
        );
        expect(second[0].covert.map(entry => entry.name)).toEqual(["Kakita Yoshi"]);
    });

    // conflictflow.ts calls updateCurrentConflict(null) twice DURING a conflict, so the
    // state publishes conflict: {} mid-conflict. That must not start a second entry --
    // this is what broke the participants in the History popup.
    it("survives the conflict being nulled mid-flight", () => {
        let ledger = recordConflictState([], state({ attackers: [berserker] }), 1);
        ledger = recordConflictState(ledger, noConflict, 1);
        ledger = recordConflictState(
            ledger,
            state({ attackers: [berserker], defenders: [whisperer], defendersChosen: true }),
            1
        );
        expect(ledger).toHaveLength(1);
        expect(ledger[0].attackers.map(entry => entry.name)).toEqual(["Matsu Berserker"]);
        expect(ledger[0].defenders.map(entry => entry.name)).toEqual(["Doji Whisperer"]);
    });

    // The declaration count is what separates conflicts, so an undefended conflict --
    // which never sets defendersChosen -- still gets its own entry.
    it("opens a new entry per declaration", () => {
        let ledger = recordConflictState([], state({ attackers: [berserker] }), 1);
        ledger = recordConflictState(ledger, state({ attackers: [prodigy] }), 2);
        expect(ledger).toHaveLength(2);
        expect(ledger[0].attackers.map(entry => entry.name)).toEqual(["Matsu Berserker"]);
        expect(ledger[1].attackers.map(entry => entry.name)).toEqual(["Ikoma Prodigy"]);
    });

    it("records an undefended conflict with no defenders", () => {
        const ledger = recordConflictState([], state({ attackers: [berserker], defendersChosen: true }), 1);
        expect(ledger[0].defenders).toEqual([]);
    });

    // A replay can seek BACKWARDS. Entries past the new declaration count describe
    // conflicts that have not happened yet at that point, so they must be dropped
    // rather than merged into.
    it("drops entries the log no longer reaches when a replay rewinds", () => {
        let ledger = recordConflictState([], state({ attackers: [berserker] }), 1);
        ledger = recordConflictState(ledger, state({ attackers: [prodigy] }), 2);
        expect(ledger).toHaveLength(2);

        ledger = recordConflictState(ledger, noConflict, 1);
        expect(ledger).toHaveLength(1);
        expect(ledger[0].attackers.map(entry => entry.name)).toEqual(["Matsu Berserker"]);
    });

    it("clears the ledger when a replay rewinds past every conflict", () => {
        let ledger = recordConflictState([], state({ attackers: [berserker] }), 1);
        ledger = recordConflictState(ledger, noConflict, 0);
        expect(ledger).toEqual([]);
    });
});
