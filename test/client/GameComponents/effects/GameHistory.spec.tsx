import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import GameHistory from "../../../../client/GameComponents/effects/GameHistory.jsx";

const phaseMessage = {
    message: { alert: { type: "endofround", message: ["Round", " ", 2, " ", "-", " ", "conflict", " ", "phase"] } }
};

const playMessage = {
    message: [
        { name: "kingitus", faction: "crane" },
        " plays ",
        { id: "assassination", uuid: "u-event", name: "Assassination", type: "event", packId: "core" },
        " to ",
        { message: ["discard", " ", { id: "hida-kisada", uuid: "u-victim", name: "Hida Kisada", type: "character" }] }
    ]
};

const conflictMessage = {
    message: [
        { name: "kingitus", faction: "crane" },
        " ", "is", " ", "initiating", " ", "a", " ", "military", " ", "conflict", " ", "at", " ",
        { id: "shameful-display", uuid: "u-prov", name: "Shameful Display", type: "province" },
        ",", " ", "contesting", " ",
        { id: "air-ring", uuid: "u-ring", name: "Air Ring", type: "ring", element: "air" }
    ]
};

function ledgerEntry() {
    return {
        attackers: [{ uuid: "a1", id: "matsu-berserker", name: "Matsu Berserker", type: "character" }],
        defenders: [{ uuid: "d1", id: "doji-whisperer", name: "Doji Whisperer", type: "character" }],
        covert: [{ uuid: "c1", id: "kakita-yoshi", name: "Kakita Yoshi", type: "character" }],
        covertSources: [{ uuid: "s1", id: "shosuro-shinobi", name: "Shosuro Shinobi", type: "character" }]
    };
}

function renderHistory(overrides = {}) {
    const props = {
        messages: [phaseMessage, playMessage],
        conflictLedger: [],
        onCardMouseOver: vi.fn(),
        onCardMouseOut: vi.fn(),
        onClose: vi.fn(),
        ...overrides
    };
    return { ...render(<GameHistory { ...props } />), props };
}

describe("the <GameHistory /> popup", () => {
    it("renders a phase banner and a play row", () => {
        const { container } = renderHistory();
        expect(screen.getByText("Round 2 - conflict phase")).toBeInTheDocument();
        expect(container.querySelectorAll(".spotlight-ribbon__row")).toHaveLength(1);
        expect(screen.getByAltText("Assassination")).toBeInTheDocument();
    });

    it("says so when nothing has happened", () => {
        renderHistory({ messages: [] });
        expect(screen.getByText("Nothing has happened yet.")).toBeInTheDocument();
    });

    it("shows the conflict participants recorded by the ledger", () => {
        renderHistory({ messages: [conflictMessage], conflictLedger: [ledgerEntry()] });
        expect(screen.getByText("Attackers")).toBeInTheDocument();
        expect(screen.getByText("Defenders")).toBeInTheDocument();
        expect(screen.getByText("Covert")).toBeInTheDocument();
        expect(screen.getByAltText("Matsu Berserker")).toBeInTheDocument();
        expect(screen.getByAltText("Doji Whisperer")).toBeInTheDocument();
        // A single covert source pairs unambiguously with the bypassed defender.
        expect(screen.getByAltText("Shosuro Shinobi")).toBeInTheDocument();
        expect(screen.getByAltText("Kakita Yoshi")).toBeInTheDocument();
    });

    it("drives the board zoom pane on hover", () => {
        const { props } = renderHistory();
        const art = screen.getByAltText("Assassination");
        fireEvent.mouseOver(art);
        expect(props.onCardMouseOver).toHaveBeenCalledWith(
            expect.objectContaining({ id: "assassination", name: "Assassination" })
        );
        fireEvent.mouseOut(art);
        expect(props.onCardMouseOut).toHaveBeenCalled();
    });

    it("closes on the close button and on the backdrop", () => {
        const { props, container } = renderHistory();
        fireEvent.click(screen.getByLabelText("Close"));
        expect(props.onClose).toHaveBeenCalledTimes(1);

        fireEvent.click(container.querySelector(".game-history__backdrop"));
        expect(props.onClose).toHaveBeenCalledTimes(2);
    });

    it("closes on Escape", () => {
        const { props } = renderHistory();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("focuses the close button so the keyboard starts inside the dialog", () => {
        renderHistory();
        expect(screen.getByLabelText("Close")).toHaveFocus();
    });

    // The log is oldest-first and the question is almost always "what just happened".
    it("opens scrolled to the newest entry", () => {
        const { container } = renderHistory();
        const body = container.querySelector(".game-history__body");
        // jsdom reports every scroll dimension as 0, so the assertion is that the
        // component wrote the scroll position at all rather than leaving it untouched.
        expect(body.scrollTop).toBe(body.scrollHeight);
    });
});
