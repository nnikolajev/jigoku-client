import { describe, it, expect } from "vitest";
import { buildGameHistory } from "../../../../client/GameComponents/effects/gameHistory.js";

// Phase.ts opens every phase with
// addAlert('endofround', 'Round {0} - {1} phase', roundNumber, name), and GameChat
// wraps an alert as { message: { alert: { type, message } } }.
const phaseMessage = {
    message: {
        alert: {
            type: "endofround",
            message: ["Round", " ", 2, " ", "-", " ", "conflict", " ", "phase"]
        }
    }
};

// conflictflow.ts: '{0} is initiating a {1} conflict at {2}, contesting {3}'
const conflictMessage = {
    message: [
        { name: "Player One", faction: "crane" },
        " ",
        "is",
        " ",
        "initiating",
        " ",
        "a",
        " ",
        "military",
        " ",
        "conflict",
        " ",
        "at",
        " ",
        { id: "shameful-display", uuid: "u-prov", name: "Shameful Display", type: "province", packId: "core" },
        ",",
        " ",
        "contesting",
        " ",
        { id: "air-ring", uuid: "u-ring", name: "Air Ring", type: "ring", element: "air" }
    ]
};

const playMessage = {
    message: [
        { name: "Player Two", faction: "scorpion" },
        " plays ",
        { id: "assassination", uuid: "u-event", name: "Assassination", type: "event", packId: "core" },
        " to ",
        { message: ["discard", " ", { id: "hida-kisada", uuid: "u-victim", name: "Hida Kisada", type: "character" }] }
    ]
};

const noiseMessage = {
    message: [{ name: "Player One", faction: "crane" }, " ", "draws", " ", 1, " ", "card"]
};

describe("buildGameHistory", () => {
    it("emits a phase banner for the round/phase alert", () => {
        const rows = buildGameHistory([phaseMessage]);
        expect(rows).toHaveLength(1);
        expect(rows[0].kind).toBe("phase");
        expect(rows[0].label).toBe("Round 2 - conflict phase");
    });

    it("emits a conflict row with its ring and province", () => {
        const rows = buildGameHistory([conflictMessage]);
        expect(rows).toHaveLength(1);
        expect(rows[0].kind).toBe("conflict");
        expect(rows[0].playerName).toBe("Player One");
        expect(rows[0].conflictType).toBe("military");
        expect(rows[0].ring.element).toBe("air");
        expect(rows[0].province.name).toBe("Shameful Display");
    });

    // The history is deliberately FULL: an entry with no play verb still becomes a row,
    // otherwise keyword payoffs and skill announcements vanish from it.
    it("keeps every game entry, classified", () => {
        const rows = buildGameHistory([phaseMessage, noiseMessage, playMessage, conflictMessage]);
        expect(rows.map(row => row.kind)).toEqual(["phase", "text", "play", "conflict"]);
        expect(rows[2].event.source.name).toBe("Assassination");
    });

    // CourtesyAbility/SincerityAbility set properties.message, so their log entries
    // carry no play verb at all -- they must still show, with the card's art.
    it("keeps a keyword payoff as a note row with its card", () => {
        const courtesy = {
            message: [
                { name: "Player One", faction: "crane" },
                " ",
                "gains",
                " ",
                "a",
                " ",
                "fate",
                " ",
                "due",
                " ",
                "to",
                " ",
                { id: "doji-whisperer", uuid: "u-c", name: "Doji Whisperer", type: "character" },
                "'s Courtesy"
            ]
        };
        const rows = buildGameHistory([courtesy]);
        expect(rows[0].kind).toBe("note");
        expect(rows[0].cards[0].name).toBe("Doji Whisperer");
        expect(rows[0].text).toContain("Courtesy");
    });

    // The amount lives in its own numeric fragment; dropping non-strings loses it.
    it("keeps numeric amounts in the text", () => {
        const withFate = {
            message: [
                { name: "Player One", faction: "crane" },
                " plays ",
                { id: "kakita-yoshi", uuid: "u-y", name: "Kakita Yoshi", type: "character" },
                " ",
                "at home with ",
                2,
                " additional fate"
            ]
        };
        const rows = buildGameHistory([withFate]);
        expect(rows[0].kind).toBe("play");
        expect(rows[0].event.text).toContain("2");
    });

    it("folds the recorded participants into the conflict row", () => {
        const ledger = [{
            attackers: [{ uuid: "a1", id: "matsu-berserker", name: "Matsu Berserker", type: "character" }],
            defenders: [{ uuid: "d1", id: "doji-whisperer", name: "Doji Whisperer", type: "character" }],
            covert: [{ uuid: "c1", id: "kakita-yoshi", name: "Kakita Yoshi", type: "character" }],
            covertSources: [{ uuid: "a9", id: "shosuro-shinobi", name: "Shosuro Shinobi", type: "character" }]
        }];
        const rows = buildGameHistory([conflictMessage], ledger);
        expect(rows[0].attackers.map(card => card.name)).toEqual(["Matsu Berserker"]);
        expect(rows[0].defenders.map(card => card.name)).toEqual(["Doji Whisperer"]);
        expect(rows[0].covert.map(pair => pair.target.name)).toEqual(["Kakita Yoshi"]);
        expect(rows[0].covert[0].source.name).toBe("Shosuro Shinobi");
    });

    // The engine never records who covert-ed whom. With one covert attacker the pairing
    // is unambiguous; with an ambiguous count the source is left blank rather than
    // guessed.
    it("leaves the covert source blank when the pairing is ambiguous", () => {
        const ledger = [{
            attackers: [],
            defenders: [],
            covert: [
                { uuid: "c1", id: "a", name: "First Target", type: "character" },
                { uuid: "c2", id: "b", name: "Second Target", type: "character" }
            ],
            covertSources: [
                { uuid: "s1", id: "c", name: "One", type: "character" },
                { uuid: "s2", id: "d", name: "Two", type: "character" },
                { uuid: "s3", id: "e", name: "Three", type: "character" }
            ]
        }];
        const rows = buildGameHistory([conflictMessage], ledger);
        expect(rows[0].covert.every(pair => pair.source === null)).toBe(true);
    });

    it("pairs each conflict row with its own ledger entry, in order", () => {
        const ledger = [
            { attackers: [{ uuid: "a1", id: "x", name: "First", type: "character" }], defenders: [], covert: [], covertSources: [] },
            { attackers: [{ uuid: "a2", id: "y", name: "Second", type: "character" }], defenders: [], covert: [], covertSources: [] }
        ];
        const rows = buildGameHistory([conflictMessage, playMessage, conflictMessage], ledger);
        const conflicts = rows.filter(row => row.kind === "conflict");
        expect(conflicts.map(row => row.attackers[0].name)).toEqual(["First", "Second"]);
    });

    it("leaves chat out of the history", () => {
        const chat = { message: [{ name: "Player One", emailHash: "abc" }, " ", "nice play"] };
        expect(buildGameHistory([chat])).toEqual([]);
    });

    it("preserves log order", () => {
        const rows = buildGameHistory([conflictMessage, phaseMessage, playMessage]);
        expect(rows.map(row => row.kind)).toEqual(["conflict", "phase", "play"]);
    });

    it("handles an empty log", () => {
        expect(buildGameHistory([])).toEqual([]);
        expect(buildGameHistory(null)).toEqual([]);
    });
});

// Court Games logs the play and the chosen target as two entries. The history must
// show one row with an arrow, not a play row with no target plus a headless note.
describe("target continuations in the history", () => {
    const courtGamesPlay = {
        message: [
            { name: "kingitus", faction: "crane" },
            " uses ",
            { id: "court-games", uuid: "u-cg", name: "Court Games", type: "event" },
            " to ",
            { message: ["honor", " ", "a", " ", "friendly", " ", "character"] }
        ]
    };
    const courtGamesChoice = {
        message: [
            { name: "kingitus", faction: "crane" },
            " ", "chooses", " ", "to", " ", "honor", " ",
            { id: "doji-whisperer", uuid: "u-target", name: "Doji Whisperer", type: "character" }
        ]
    };

    it("folds the chosen target into the play row", () => {
        const rows = buildGameHistory([courtGamesPlay, courtGamesChoice]);
        expect(rows).toHaveLength(1);
        expect(rows[0].kind).toBe("play");
        expect(rows[0].event.source.name).toBe("Court Games");
        expect(rows[0].event.targets.map(card => card.name)).toEqual(["Doji Whisperer"]);
        expect(rows[0].event.text).toContain("chooses to honor Doji Whisperer");
    });

    // Nothing to attach to: it must still be visible rather than swallowed.
    it("keeps a stray follow-up as its own row", () => {
        const rows = buildGameHistory([courtGamesChoice]);
        expect(rows).toHaveLength(1);
        expect(rows[0].kind).toBe("note");
        expect(rows[0].cards.map(card => card.name)).toEqual(["Doji Whisperer"]);
    });
});

// With server records the history needs no ledger and no declaration-count keying: the
// declaration, the covert pairings and the defenders all carry the same conflictId.
describe("server-recorded conflicts", () => {
    const ring = { id: "air-ring", uuid: "u-ring", name: "Air Ring", type: "ring", element: "air" };
    const provinceCard = { id: "shameful-display", uuid: "u-prov", name: "Shameful Display", type: "province" };
    const berserker = { id: "matsu-berserker", uuid: "a1", name: "Matsu Berserker", type: "character" };
    const shinobi = { id: "shosuro-shinobi", uuid: "a2", name: "Shosuro Shinobi", type: "character" };
    const whisperer = { id: "doji-whisperer", uuid: "d1", name: "Doji Whisperer", type: "character" };
    const yoshi = { id: "kakita-yoshi", uuid: "c1", name: "Kakita Yoshi", type: "character" };

    const declaredMessage = {
        message: [{ name: "kingitus" }, " ", "is", " ", "initiating", " ", "a", " ", "military", " ", "conflict"],
        record: {
            kind: "conflict-declared",
            conflictId: 1,
            player: "kingitus",
            conflictType: "military",
            ring,
            province: provinceCard,
            attackers: [berserker, shinobi]
        }
    };
    const covertMessage = {
        message: [{ name: "kingitus" }, " ", "uses", " ", "covert"],
        record: { kind: "conflict-covert", conflictId: 1, covert: [{ source: shinobi, target: yoshi }] }
    };
    const defendersMessage = {
        message: [{ name: "Jigoku Bot" }, " ", "has", " ", "defended"],
        record: { kind: "conflict-defenders", conflictId: 1, player: "Jigoku Bot", defenders: [whisperer] }
    };

    it("folds the declaration, covert and defenders into one row", () => {
        const rows = buildGameHistory([declaredMessage, covertMessage, defendersMessage]);
        expect(rows).toHaveLength(1);
        expect(rows[0].kind).toBe("conflict");
        expect(rows[0].attackers.map(card => card.name)).toEqual(["Matsu Berserker", "Shosuro Shinobi"]);
        expect(rows[0].defenders.map(card => card.name)).toEqual(["Doji Whisperer"]);
        expect(rows[0].ring.element).toBe("air");
        expect(rows[0].province.name).toBe("Shameful Display");
    });

    // The exact pairing, not a count match: the server knows which attacker spent covert.
    it("takes the real covert pairing from the record", () => {
        const rows = buildGameHistory([declaredMessage, covertMessage, defendersMessage]);
        expect(rows[0].covert).toHaveLength(1);
        expect(rows[0].covert[0].source.name).toBe("Shosuro Shinobi");
        expect(rows[0].covert[0].target.name).toBe("Kakita Yoshi");
    });

    it("keeps two recorded conflicts apart by conflictId", () => {
        const second = {
            message: [{ name: "kingitus" }, " ", "is", " ", "initiating", " ", "a", " ", "political", " ", "conflict"],
            record: { kind: "conflict-declared", conflictId: 2, player: "kingitus", conflictType: "political", attackers: [whisperer] }
        };
        const secondDefenders = {
            message: [{ name: "Jigoku Bot" }, " ", "has", " ", "defended"],
            record: { kind: "conflict-defenders", conflictId: 2, player: "Jigoku Bot", defenders: [berserker] }
        };
        const rows = buildGameHistory([declaredMessage, defendersMessage, second, secondDefenders]);
        const conflicts = rows.filter(row => row.kind === "conflict");
        expect(conflicts).toHaveLength(2);
        expect(conflicts[0].defenders.map(card => card.name)).toEqual(["Doji Whisperer"]);
        expect(conflicts[1].defenders.map(card => card.name)).toEqual(["Matsu Berserker"]);
    });

    // Recorded conflicts must not also consume ledger entries meant for older games.
    it("ignores the ledger when records are present", () => {
        const ledger = [{ attackers: [yoshi], defenders: [], covert: [], covertSources: [] }];
        const rows = buildGameHistory([declaredMessage], ledger);
        expect(rows[0].attackers.map(card => card.name)).toEqual(["Matsu Berserker", "Shosuro Shinobi"]);
    });
});
