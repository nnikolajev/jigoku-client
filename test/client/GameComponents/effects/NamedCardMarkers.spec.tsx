import { describe, expect, it, afterEach, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import React from "react";

import NamedCardMarkers from "../../../../client/GameComponents/effects/NamedCardMarkers.jsx";

// The naming card renders with id={card.uuid}; jsdom reports a zero-sized rect for
// everything, which the anchor treats as "not on screen", so it has to be stubbed.
const planted: HTMLElement[] = [];

function rect(left: number, top: number, width: number, height: number) {
    return () => ({
        left, top, width, height,
        right: left + width, bottom: top + height,
        x: left, y: top, toJSON: () => ({})
    });
}

function plant(uuid: string) {
    const element = document.createElement("div");
    element.id = uuid;
    element.getBoundingClientRect = rect(100, 200, 80, 110);
    document.body.appendChild(element);
    planted.push(element);
    return element;
}

// The real board puts the naming stronghold in a row with the role card and the
// imperial favor on either side of it.
function plantStrongholdRow(uuid: string) {
    const row = document.createElement("div");
    row.className = "player-stronghold-row our-side";
    const role = document.createElement("div");
    role.className = "rolecard";
    role.getBoundingClientRect = rect(10, 200, 80, 110);
    const stronghold = document.createElement("div");
    stronghold.id = uuid;
    stronghold.getBoundingClientRect = rect(100, 200, 80, 110);
    row.append(role, stronghold);
    document.body.appendChild(row);
    planted.push(row);
}

afterEach(() => {
    planted.splice(0).forEach(element => element.remove());
});

const named = { name: "Fine Katana", id: "fine-katana", packId: "core", sourceUuid: "u-sk", sourceName: "Shiro Kitsuki" };

describe("the <NamedCardMarkers /> overlay", () => {
    it("renders nothing when nothing is named", () => {
        const { container } = render(<NamedCardMarkers namedCards={ [] } />);
        expect(container).toBeEmptyDOMElement();
    });

    it("pins the named card beside the card that named it", () => {
        plant("u-sk");
        const { container, getByAltText } = render(<NamedCardMarkers namedCards={ [named] } />);
        expect(getByAltText("Fine Katana")).toBeInTheDocument();
        const marker = container.querySelector<HTMLElement>(".named-card-marker");
        // Anchor is left 100 wide 80, so the marker sits just to its right.
        expect(parseInt(marker.style.left, 10)).toBeGreaterThanOrEqual(180);
    });

    // Both horizontal neighbours of a stronghold are taken -- role card one side,
    // imperial favor the other -- so the marker drops under the role card instead.
    it("drops under the role card when the naming card is in the stronghold row", () => {
        plantStrongholdRow("u-sk");
        const { container } = render(<NamedCardMarkers namedCards={ [named] } />);
        const marker = container.querySelector<HTMLElement>(".named-card-marker");
        // Role card is left 10 wide 80, bottom 310.
        expect(parseInt(marker.style.left, 10)).toBe(18);
        expect(parseInt(marker.style.top, 10)).toBeGreaterThanOrEqual(310);
    });

    it("says which card did the naming", () => {
        plant("u-sk");
        const { container } = render(<NamedCardMarkers namedCards={ [named] } />);
        expect(container.querySelector(".named-card-marker")?.getAttribute("title"))
            .toBe("Shiro Kitsuki: Fine Katana");
    });

    it("zooms the named card on hover", () => {
        plant("u-sk");
        const onCardMouseOver = vi.fn();
        const onCardMouseOut = vi.fn();
        const { container } = render(
            <NamedCardMarkers namedCards={ [named] } onCardMouseOver={ onCardMouseOver } onCardMouseOut={ onCardMouseOut } />
        );
        const marker = container.querySelector(".named-card-marker");
        fireEvent.mouseOver(marker);
        expect(onCardMouseOver).toHaveBeenCalledWith(named);
        fireEvent.mouseOut(marker);
        expect(onCardMouseOut).toHaveBeenCalled();
    });

    // The naming card can be off screen -- a stronghold scrolled out of the play area,
    // or a card that has left play -- and an unanchored marker would float over nothing.
    it("draws nothing when the naming card is not on screen", () => {
        const { container } = render(<NamedCardMarkers namedCards={ [named] } />);
        expect(container).toBeEmptyDOMElement();
    });

    it("draws nothing for a name it could not resolve to a printing", () => {
        plant("u-sk");
        const { container } = render(
            <NamedCardMarkers namedCards={ [{ name: "Not A Card", sourceUuid: "u-sk" }] } />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
