import { describe, expect, it, afterEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

import SpotlightRail, { railMetrics } from "../../../../client/GameComponents/effects/SpotlightRail.jsx";

const planted: HTMLElement[] = [];

// Board cards render with id={card.uuid}; jsdom gives every element a zero-sized rect,
// which anchorFor reads as "not on screen", so a target has to be stubbed to be drawn.
function plant(uuid: string) {
    const element = document.createElement("div");
    element.id = uuid;
    element.getBoundingClientRect = () =>
        ({ left: 100, top: 200, width: 80, height: 110, right: 180, bottom: 310, x: 100, y: 200, toJSON: () => ({}) });
    document.body.appendChild(element);
    planted.push(element);
}

afterEach(() => {
    planted.splice(0).forEach(element => element.remove());
});

function event(overrides = {}) {
    return {
        key: "k1",
        verb: "plays",
        playerName: "kingitus",
        source: { uuid: "u-src", id: "assassination", name: "Assassination", type: "event", packId: "core" },
        targets: [],
        cancels: false,
        text: "kingitus plays Assassination",
        ...overrides
    };
}

describe("railMetrics", () => {
    // The zoom pane it sits beside is a hard 338px with no responsive rule, so the
    // gutter cannot shrink -- the cards do.
    it("shrinks the card on a narrow viewport", () => {
        expect(railMetrics(1920).cardWidth).toBe(154);
        expect(railMetrics(1366).cardWidth).toBe(132);
        expect(railMetrics(1024).cardWidth).toBe(112);
    });

    it("keeps the card proportions at every size", () => {
        for(const width of [1920, 1366, 1024]) {
            const metrics = railMetrics(width);
            expect(metrics.cardHeight / metrics.cardWidth).toBeCloseTo(215 / 154, 2);
        }
    });
});

describe("the <SpotlightRail /> overlay", () => {
    it("renders nothing with no events", () => {
        const { container } = render(<SpotlightRail events={ [] } />);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the played card with the player and verb", () => {
        const { container, getByAltText, getByText } = render(<SpotlightRail events={ [event()] } />);
        expect(getByAltText("Assassination")).toBeInTheDocument();
        expect(getByText("kingitus")).toBeInTheDocument();
        expect(getByText("plays")).toBeInTheDocument();
        expect(container.querySelectorAll(".spotlight-rail__card")).toHaveLength(1);
    });

    it("draws an arrow to a target that is on the board", () => {
        plant("u-target");
        const { container } = render(
            <SpotlightRail events={ [event({ targets: [{ uuid: "u-target", id: "t", name: "Target", type: "character" }] })] } />
        );
        expect(container.querySelectorAll("path.spotlight-arrow")).toHaveLength(1);
    });

    it("draws no arrow for a target that is not rendered", () => {
        const { container } = render(
            <SpotlightRail events={ [event({ targets: [{ uuid: "nowhere", id: "t", name: "Target", type: "character" }] })] } />
        );
        expect(container.querySelectorAll("path.spotlight-arrow")).toHaveLength(0);
    });

    // A cancel has no board target worth pointing at, so it points at the rail card it
    // is answering instead.
    it("points a cancel at the entry below it", () => {
        const { container } = render(
            <SpotlightRail events={ [event(), event({ key: "k2", cancels: true, targets: [] })] } />
        );
        expect(container.querySelectorAll(".spotlight-rail__card--cancel")).toHaveLength(1);
        expect(container.querySelectorAll("path.spotlight-arrow--cancel")).toHaveLength(1);
    });

    it("stacks later entries further down and further left", () => {
        const { container } = render(<SpotlightRail events={ [event(), event({ key: "k2" })] } />);
        const cards = container.querySelectorAll<HTMLElement>(".spotlight-rail__card");
        expect(parseInt(cards[1].style.top, 10)).toBeGreaterThan(parseInt(cards[0].style.top, 10));
        expect(parseInt(cards[1].style.right, 10)).toBeGreaterThan(parseInt(cards[0].style.right, 10));
    });
});

// One rail entry per source card. A card played and then given its target in a separate
// log entry is ONE thing happening, so the second entry must join the first rather than
// stack a duplicate -- and an unrelated card must never inherit that arrow.
describe("one entry per source card", () => {
    function play(uuid: string, name: string, targets = []) {
        return {
            key: `k-${uuid}`,
            verb: "uses",
            playerName: "kingitus",
            source: { uuid, id: name.toLowerCase(), name, type: "character", packId: "core" },
            targets,
            cancels: false,
            text: `kingitus uses ${name}`
        };
    }

    it("shows one card per distinct source", () => {
        const { container } = render(
            <SpotlightRail events={ [play("u1", "Kudaka"), play("u2", "Shinobi")] } />
        );
        expect(container.querySelectorAll(".spotlight-rail__card")).toHaveLength(2);
    });

    it("draws an arrow for a target that arrived on a later entry", () => {
        plant("u-target");
        const merged = play("u1", "Kudaka", [{ uuid: "u-target", id: "t", name: "Target", type: "character" }]);
        const { container } = render(<SpotlightRail events={ [merged] } />);
        expect(container.querySelectorAll(".spotlight-rail__card")).toHaveLength(1);
        expect(container.querySelectorAll("path.spotlight-arrow")).toHaveLength(1);
    });
});
