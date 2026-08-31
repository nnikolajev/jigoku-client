import { describe, it, expect } from "vitest";
import {
    advanceDeclarationTally,
    countConflictDeclarations
} from "../../../../client/GameComponents/effects/messageFragments.js";

// conflictflow.ts announces every declaration with
// '{0} is initiating a {1} conflict at {2}, contesting {3}'.
function declaration() {
    return {
        message: [
            { name: "One", faction: "lion" },
            " ", "is", " ", "initiating", " ", "a", " ", "military", " ", "conflict"
        ]
    };
}

function noise() {
    return { message: [{ name: "One", faction: "lion" }, " ", "draws", " ", 1, " ", "card"] };
}

// A player typing the word must not be counted as a declaration.
function chat() {
    return { message: [{ name: "One", emailHash: "abc" }, " ", "initiating now?"] };
}

describe("countConflictDeclarations", () => {
    it("counts only declarations", () => {
        expect(countConflictDeclarations([noise(), declaration(), noise(), declaration()])).toBe(2);
    });

    it("ignores chat", () => {
        expect(countConflictDeclarations([chat(), declaration()])).toBe(1);
    });

    it("can start from an offset", () => {
        expect(countConflictDeclarations([declaration(), noise(), declaration()], 1)).toBe(1);
    });

    it("handles an empty or missing log", () => {
        expect(countConflictDeclarations([])).toBe(0);
        expect(countConflictDeclarations(null)).toBe(0);
    });
});

describe("advanceDeclarationTally", () => {
    const empty = { count: 0, scanned: 0 };

    it("reads only the messages that arrived", () => {
        const log = [declaration(), noise()];
        const first = advanceDeclarationTally(empty, log);
        expect(first).toEqual({ count: 1, scanned: 2 });

        const grown = [...log, declaration()];
        expect(advanceDeclarationTally(first, grown)).toEqual({ count: 2, scanned: 3 });
    });

    it("returns the same object when nothing was appended", () => {
        const log = [declaration()];
        const first = advanceDeclarationTally(empty, log);
        expect(advanceDeclarationTally(first, log)).toBe(first);
    });

    // A replay seeking backwards, or a new game, shortens the log. The running total
    // would be wrong, so it is recounted.
    it("recounts from scratch when the log shrank", () => {
        const long = [declaration(), noise(), declaration(), declaration()];
        const tally = advanceDeclarationTally(empty, long);
        expect(tally.count).toBe(3);

        const rewound = long.slice(0, 2);
        expect(advanceDeclarationTally(tally, rewound)).toEqual({ count: 1, scanned: 2 });
    });

    it("agrees with a full count over a long log", () => {
        const log: any[] = [];
        let tally = empty;
        for(let index = 0; index < 200; index++) {
            log.push(index % 7 === 0 ? declaration() : noise());
            tally = advanceDeclarationTally(tally, log);
        }
        expect(tally.count).toBe(countConflictDeclarations(log));
    });
});
