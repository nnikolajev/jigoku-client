import { describe, it, expect } from "vitest";
import {
    isCardPlayMessage,
    countCardPlayMessages,
    detectConflictResolution
} from "../../../../client/GameComponents/effects/gameEvents.js";

// GameChat.formatMessage on the server splits literal text into single-word
// fragments separated by " " fragments, so that is the shape tested here.
const playMessage = {
    message: [
        { id: "p1", type: "player", name: "Player One" },
        " ",
        "plays",
        " ",
        { id: "c1", name: "Doji Whisperer" }
    ]
};

const otherMessage = {
    message: [
        { id: "p1", type: "player", name: "Player One" },
        " ",
        "draws",
        " ",
        1,
        " ",
        "card"
    ]
};

const chatMessage = {
    message: [
        { emailHash: "abc", name: "Player One" },
        " my opponent always plays aggressively"
    ]
};

describe("isCardPlayMessage", () => {
    it("detects a card play log entry", () => {
        expect(isCardPlayMessage(playMessage)).toBe(true);
    });

    it("detects card plays with extra formatting fragments", () => {
        const withFate = {
            message: [
                { id: "p1", type: "player", name: "Player One" },
                " ",
                "plays",
                " ",
                { id: "c1", name: "Hida Guardian" },
                " ",
                "with",
                " ",
                2,
                " ",
                "additional",
                " ",
                "fate"
            ]
        };
        expect(isCardPlayMessage(withFate)).toBe(true);
    });

    it("still detects a card play kept as one whole string", () => {
        const wholeString = {
            message: [
                { id: "p1", type: "player", name: "Player One" },
                " plays ",
                { id: "c1", name: "Doji Whisperer" }
            ]
        };
        expect(isCardPlayMessage(wholeString)).toBe(true);
    });

    it("ignores non-play log entries", () => {
        expect(isCardPlayMessage(otherMessage)).toBe(false);
    });

    it("ignores chat messages even when they contain the word plays", () => {
        expect(isCardPlayMessage(chatMessage)).toBe(false);
    });

    it("handles missing or malformed messages", () => {
        expect(isCardPlayMessage(null)).toBe(false);
        expect(isCardPlayMessage({})).toBe(false);
        expect(isCardPlayMessage({ message: "plain string without the keyword" })).toBe(false);
    });
});

describe("countCardPlayMessages", () => {
    it("counts only card play messages", () => {
        expect(countCardPlayMessages([playMessage, otherMessage, chatMessage, playMessage])).toBe(2);
    });

    it("returns 0 for an empty log", () => {
        expect(countCardPlayMessages([])).toBe(0);
    });
});

describe("detectConflictResolution", () => {
    const activeConflict = {
        type: "military",
        attackerSkill: 12,
        defenderSkill: 7,
        declarationComplete: true
    };

    it("reports a resolution when the conflict disappears", () => {
        const result = detectConflictResolution({ conflict: activeConflict }, { conflict: null });
        expect(result).toEqual({ type: "military", winnerSkill: 12 });
    });

    it("uses the defender skill when the defender is higher", () => {
        const conflict = { ...activeConflict, type: "political", attackerSkill: 4, defenderSkill: 11 };
        const result = detectConflictResolution({ conflict }, {});
        expect(result).toEqual({ type: "political", winnerSkill: 11 });
    });

    it("returns null while the conflict is still active", () => {
        expect(detectConflictResolution({ conflict: activeConflict }, { conflict: activeConflict })).toBe(null);
    });

    it("returns null when there was no conflict", () => {
        expect(detectConflictResolution({ conflict: null }, { conflict: null })).toBe(null);
    });

    it("returns null when the conflict never completed declaration", () => {
        const undeclared = { ...activeConflict, declarationComplete: false };
        expect(detectConflictResolution({ conflict: undeclared }, { conflict: null })).toBe(null);
    });
});
