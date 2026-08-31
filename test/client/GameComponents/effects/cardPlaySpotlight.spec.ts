import { describe, it, expect } from "vitest";
import {
    parseSpotlightEvent,
    detectNewSpotlightEvents,
    detectNewTargetContinuations,
    mergeTargets,
    parseTargetContinuation
} from "../../../../client/GameComponents/effects/cardPlaySpotlight.js";

// CardAbility.displayMessage builds '{0}{1}{2}{3}{4}{5}{6}{7}{8}' from
// [player, ' uses ', source, gainedAbility, origin, '', costs, ' to ', effectMessage],
// and GameChat.formatMessage substitutes each arg whole, so the verb arrives as one
// " uses " fragment and the effect message arrives wrapped in { message: [...] }.
const usesMessage = {
    message: [
        { name: "Player One", faction: "crane" },
        " uses ",
        { id: "kakita-toshimoto", uuid: "u-source", name: "Kakita Toshimoto", type: "character", packId: "core" },
        "",
        "",
        " to ",
        {
            message: [
                "initiate",
                " ",
                "a",
                " ",
                "duel",
                " ",
                "against",
                " ",
                { id: "doji-whisperer", uuid: "u-target", name: "Doji Whisperer", type: "character", packId: "core" }
            ]
        }
    ]
};

// Events go through the same path with messageVerb 'plays'.
const playsMessage = {
    message: [
        { name: "Player Two", faction: "scorpion" },
        " plays ",
        { id: "assassination", uuid: "u-event", name: "Assassination", type: "event", packId: "core" },
        " to ",
        {
            message: [
                "discard",
                " ",
                { id: "hida-kisada", uuid: "u-victim", name: "Hida Kisada", type: "character", packId: "core" }
            ]
        }
    ]
};

const cancelMessage = {
    message: [
        { name: "Player One", faction: "crane" },
        " plays ",
        { id: "voice-of-honor", uuid: "u-cancel", name: "Voice of Honor", type: "event", packId: "core" },
        " to ",
        {
            message: [
                "cancel",
                " ",
                "the",
                " ",
                "effects",
                " ",
                "of",
                " ",
                { id: "assassination", uuid: "u-event", name: "Assassination", type: "event", packId: "core" }
            ]
        }
    ]
};

// A player typing "he uses that a lot" in chat must never light up the board. Chat
// messages are the only ones carrying an emailHash fragment.
const chatMessage = {
    message: [
        { name: "Player One", emailHash: "abc123" },
        " ",
        "he uses that a lot"
    ]
};

const noVerbMessage = {
    message: [
        { name: "Player One", faction: "crane" },
        " ",
        "draws",
        " ",
        1,
        " ",
        "card"
    ]
};

describe("parseSpotlightEvent", () => {
    it("reads the source and target out of a 'uses' message", () => {
        const event = parseSpotlightEvent(usesMessage, "k1");
        expect(event).not.toBeNull();
        expect(event.verb).toBe("uses");
        expect(event.playerName).toBe("Player One");
        expect(event.source.name).toBe("Kakita Toshimoto");
        expect(event.targets.map(target => target.uuid)).toEqual(["u-target"]);
        expect(event.cancels).toBe(false);
    });

    it("reads a 'plays' message the same way", () => {
        const event = parseSpotlightEvent(playsMessage, "k2");
        expect(event.source.id).toBe("assassination");
        expect(event.targets.map(target => target.name)).toEqual(["Hida Kisada"]);
    });

    it("flags a cancel and keeps the cancelled card as the target", () => {
        const event = parseSpotlightEvent(cancelMessage, "k3");
        expect(event.cancels).toBe(true);
        expect(event.source.name).toBe("Voice of Honor");
        expect(event.targets.map(target => target.uuid)).toEqual(["u-event"]);
    });

    it("never fires on chat, even when the text contains a verb", () => {
        expect(parseSpotlightEvent(chatMessage, "k4")).toBeNull();
    });

    it("ignores log lines with no play verb", () => {
        expect(parseSpotlightEvent(noVerbMessage, "k5")).toBeNull();
    });

    it("does not repeat the source as its own target", () => {
        const selfTarget = {
            message: [
                { name: "Player One", faction: "crane" },
                " uses ",
                { id: "c", uuid: "u-self", name: "Card", type: "character" },
                " to ",
                { message: ["bow", " ", { id: "c", uuid: "u-self", name: "Card", type: "character" }] }
            ]
        };
        expect(parseSpotlightEvent(selfTarget, "k6").targets).toEqual([]);
    });
});

describe("detectNewSpotlightEvents", () => {
    it("only parses messages appended since the previous state", () => {
        const events = detectNewSpotlightEvents([noVerbMessage], [noVerbMessage, usesMessage], 7);
        expect(events).toHaveLength(1);
        expect(events[0].key).toBe("spotlight-7-1");
    });

    it("returns nothing when no message was added", () => {
        expect(detectNewSpotlightEvents([usesMessage], [usesMessage], 1)).toEqual([]);
    });

    // A reconnect replaces the whole log at once; firing an overlay per entry would
    // paper over the board.
    it("skips a bulk resync", () => {
        const bulk = Array.from({ length: 30 }, () => usesMessage);
        expect(detectNewSpotlightEvents([], bulk, 1)).toEqual([]);
    });
});

// Court Games (and 75 other cards) log the play and the target as SEPARATE entries:
// the ability's own message names no card, and selectCard then messages
// '{0} chooses to honor {1}'. Read independently, the play has no target and the
// follow-up has no source, so the rail drew no arrow.
const courtGamesPlay = {
    message: [
        { name: "kingitus", faction: "crane" },
        " uses ",
        { id: "court-games", uuid: "u-cg", name: "Court Games", type: "event", packId: "core" },
        " to ",
        { message: ["honor", " ", "a", " ", "friendly", " ", "character"] }
    ]
};

const courtGamesChoice = {
    message: [
        { name: "kingitus", faction: "crane" },
        " ",
        "chooses",
        " ",
        "to",
        " ",
        "honor",
        " ",
        { id: "doji-whisperer", uuid: "u-target", name: "Doji Whisperer", type: "character", packId: "core" }
    ]
};

describe("target continuations", () => {
    it("reads the target out of a 'chooses' follow-up", () => {
        expect(parseTargetContinuation(courtGamesChoice).map(card => card.name)).toEqual(["Doji Whisperer"]);
    });

    it("does not treat a play entry as a follow-up", () => {
        expect(parseTargetContinuation(courtGamesPlay)).toEqual([]);
    });

    it("ignores a 'chooses' entry that names no card", () => {
        const noCard = {
            message: [{ name: "kingitus", faction: "crane" }, " ", "chooses", " ", "to", " ", "pass"]
        };
        expect(parseTargetContinuation(noCard)).toEqual([]);
    });

    it("picks up follow-ups appended since the previous state", () => {
        const cards = detectNewTargetContinuations([courtGamesPlay], [courtGamesPlay, courtGamesChoice]);
        expect(cards.map(card => card.name)).toEqual(["Doji Whisperer"]);
    });

    it("leaves the Court Games play itself with no target", () => {
        expect(parseSpotlightEvent(courtGamesPlay, "cg").targets).toEqual([]);
    });
});

describe("mergeTargets", () => {
    it("appends without duplicating a uuid already present", () => {
        const first = { uuid: "a", id: "a", name: "A", type: "character" };
        const second = { uuid: "b", id: "b", name: "B", type: "character" };
        expect(mergeTargets([first], [first, second]).map(card => card.uuid)).toEqual(["a", "b"]);
    });

    it("returns the same array when nothing is added", () => {
        const existing = [{ uuid: "a", id: "a", name: "A", type: "character" }];
        expect(mergeTargets(existing, [])).toBe(existing);
    });
});

// The server attaches a structured record to the entries the client needs to read
// precisely. It names the source and targets outright, so it covers abilities whose
// message follows no fixed shape -- the verb heuristic can never read those.
describe("server-recorded events", () => {
    const source = { id: "kudaka", uuid: "u-src", name: "Kudaka", type: "character", packId: "core" };
    const target = { id: "doji-whisperer", uuid: "u-tgt", name: "Doji Whisperer", type: "character" };

    it("reads a play record instead of parsing the prose", () => {
        const recorded = {
            message: [{ name: "kingitus" }, " ", "resolves", " ", "the", " ", "air", " ", "ring"],
            record: { kind: "play", player: "kingitus", verb: "uses", source, targets: [target] }
        };
        const event = parseSpotlightEvent(recorded, "k");
        expect(event.source.name).toBe("Kudaka");
        expect(event.verb).toBe("uses");
        expect(event.playerName).toBe("kingitus");
        expect(event.targets.map(card => card.name)).toEqual(["Doji Whisperer"]);
    });

    // The whole point: an entry with no play verb at all still produces an overlay.
    it("fires on a custom message the verb heuristic cannot read", () => {
        const custom = {
            message: [{ name: "kingitus" }, " ", "gains", " ", "1", " ", "fate"],
            record: { kind: "play", player: "kingitus", verb: "uses", source, targets: [] }
        };
        expect(parseSpotlightEvent(custom, "k")).not.toBeNull();
        // Without the record the same entry is silent.
        expect(parseSpotlightEvent({ message: custom.message }, "k")).toBeNull();
    });

    it("still flags a cancel from the recorded entry's text", () => {
        const recorded = {
            message: [{ name: "kingitus" }, " ", "cancels", " ", "the", " ", "effects"],
            record: { kind: "play", player: "kingitus", verb: "plays", source, targets: [] }
        };
        expect(parseSpotlightEvent(recorded, "k").cancels).toBe(true);
    });

    // A recorded follow-up names its own source, so it stands as an event rather than
    // being attached to whatever was played last -- attaching by position is what showed
    // an unrelated card again on every prompt.
    it("reads a recorded follow-up as an event of its own", () => {
        const recorded = {
            message: [{ name: "kingitus" }, " ", "chooses"],
            record: { kind: "target", player: "kingitus", source, targets: [target] }
        };
        const event = parseSpotlightEvent(recorded, "k");
        expect(event.source.name).toBe("Kudaka");
        expect(event.targets.map(card => card.name)).toEqual(["Doji Whisperer"]);
    });

    // Nothing recorded ever comes through the positional path.
    it("never treats a recorded entry as an orphan follow-up", () => {
        for(const kind of ["target", "play"]) {
            const recorded = {
                message: [{ name: "kingitus" }, " ", "chooses"],
                record: { kind, player: "kingitus", source, targets: [target] }
            };
            expect(parseTargetContinuation(recorded)).toEqual([]);
        }
    });

    it("falls back to the prose when there is no record", () => {
        const event = parseSpotlightEvent(playsMessage, "k");
        expect(event.source.name).toBe("Assassination");
    });
});
