import { describe, expect, it, afterEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

import ConflictArrows from "../../../../client/GameComponents/effects/ConflictArrows.jsx";

// Board cards render with id={card.uuid} (GameBoard/Province/Card), which is the handle
// the overlay anchors to. jsdom gives every element a zero-sized rect, and anchorFor
// treats that as "not on screen", so the rect has to be stubbed for the mark to appear.
const planted: HTMLElement[] = [];

function plant(uuid: string, top: number) {
    const element = document.createElement("div");
    element.id = uuid;
    element.getBoundingClientRect = () =>
        ({ left: 100, top, width: 80, height: 110, right: 180, bottom: top + 110, x: 100, y: top, toJSON: () => ({}) });
    document.body.appendChild(element);
    planted.push(element);
    return element;
}

afterEach(() => {
    planted.splice(0).forEach(element => element.remove());
});

function character(uuid: string, name: string) {
    return { uuid, id: name.toLowerCase(), name, type: "character", inConflict: true };
}

function province(uuid: string) {
    return { uuid, id: "shameful-display", name: "Shameful Display", type: "province", inConflict: true };
}

function players({ attackers = [], defenders = [], contested = null }) {
    return [
        { id: "p1", name: "Me", cardPiles: { cardsInPlay: attackers }, provinces: {} },
        {
            id: "p2",
            name: "Them",
            cardPiles: { cardsInPlay: defenders },
            provinces: { one: contested ? [contested] : [] }
        }
    ];
}

const declared = { declarationComplete: true, attackingPlayerId: "p1", defendingPlayerId: "p2" };

describe("the <ConflictArrows /> overlay", () => {
    it("renders nothing before the conflict is declared", () => {
        const { container } = render(
            <ConflictArrows conflict={ { declarationComplete: false } } players={ players({}) } viewerPlayerName="Me" />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("marks an attacker red and a defender blue", () => {
        plant("a1", 500);
        plant("d1", 100);
        const { container } = render(
            <ConflictArrows
                conflict={ declared }
                players={ players({ attackers: [character("a1", "Berserker")], defenders: [character("d1", "Whisperer")] }) }
                viewerPlayerName="Me"
            />
        );
        expect(container.querySelectorAll(".conflict-mark--attack")).toHaveLength(1);
        expect(container.querySelectorAll(".conflict-mark--defend")).toHaveLength(1);
    });

    // The viewer's own board is the bottom half, so their marks point up and the
    // opponent's are flipped.
    it("flips the mark for the board half at the top of the screen", () => {
        plant("a1", 500);
        plant("d1", 100);
        const { container } = render(
            <ConflictArrows
                conflict={ declared }
                players={ players({ attackers: [character("a1", "Berserker")], defenders: [character("d1", "Whisperer")] }) }
                viewerPlayerName="Me"
            />
        );
        expect(container.querySelector(".conflict-mark--attack")).not.toHaveClass("conflict-mark--down");
        expect(container.querySelector(".conflict-mark--defend")).toHaveClass("conflict-mark--down");
    });

    it("skips a participant that is not rendered on the board", () => {
        const { container } = render(
            <ConflictArrows
                conflict={ declared }
                players={ players({ attackers: [character("missing", "Ghost")] }) }
                viewerPlayerName="Me"
            />
        );
        expect(container.querySelectorAll(".conflict-mark")).toHaveLength(0);
    });

    it("puts swords over the contested province", () => {
        plant("prov", 300);
        const { container } = render(
            <ConflictArrows conflict={ declared } players={ players({ contested: province("prov") }) } viewerPlayerName="Me" />
        );
        const mark = container.querySelector(".conflict-province-mark");
        expect(mark).toHaveTextContent("⚔");
        expect(mark).not.toHaveClass("conflict-province-mark--breaking");
    });

    // conflict.breaking is the engine's own reading of "this province falls".
    it("switches to a skull once the province is breaking", () => {
        plant("prov", 300);
        const { container } = render(
            <ConflictArrows
                conflict={ { ...declared, breaking: true } }
                players={ players({ contested: province("prov") }) }
                viewerPlayerName="Me"
            />
        );
        const mark = container.querySelector(".conflict-province-mark");
        expect(mark).toHaveTextContent("☠");
        expect(mark).toHaveClass("conflict-province-mark--breaking");
    });
});
