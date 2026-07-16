import { describe, it, expect } from "vitest";
import {
    isCardPlayMessage,
    countCardPlayMessages,
    detectConflictProvinceBreak
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

describe("detectConflictProvinceBreak", () => {
    const activeConflict = {
        type: "military",
        attackerSkill: 12,
        defenderSkill: 7,
        declarationComplete: true
    };

    function gameState(conflict: any, isBroken: boolean) {
        return {
            conflict,
            players: {
                player1: {
                    provinces: {
                        one: [{ uuid: "province-1", isProvince: true, isBroken }]
                    },
                    strongholdProvince: []
                }
            }
        };
    }

    it("reports a break while the conflict remains active", () => {
        const result = detectConflictProvinceBreak(
            gameState(activeConflict, false),
            gameState(activeConflict, true)
        );
        expect(result).toEqual({ type: "military", skillDifference: 5 });
    });

    it("uses the previous conflict if cleanup happens in the same update", () => {
        const result = detectConflictProvinceBreak(
            gameState(activeConflict, false),
            gameState({}, true)
        );
        expect(result).toEqual({ type: "military", skillDifference: 5 });
    });

    it("calculates the winning margin when defender is higher", () => {
        const conflict = { ...activeConflict, type: "political", attackerSkill: 4, defenderSkill: 11 };
        const result = detectConflictProvinceBreak(gameState(conflict, false), gameState(conflict, true));
        expect(result).toEqual({ type: "political", skillDifference: 7 });
    });

    it("returns null while no province becomes broken", () => {
        expect(detectConflictProvinceBreak(
            gameState(activeConflict, false),
            gameState(activeConflict, false)
        )).toBe(null);
    });

    it("returns null when a province was already broken", () => {
        expect(detectConflictProvinceBreak(
            gameState(activeConflict, true),
            gameState(activeConflict, true)
        )).toBe(null);
    });

    it("returns null when the conflict never completed declaration", () => {
        const undeclared = { ...activeConflict, declarationComplete: false };
        expect(detectConflictProvinceBreak(
            gameState(undeclared, false),
            gameState(undeclared, true)
        )).toBe(null);
    });
});
