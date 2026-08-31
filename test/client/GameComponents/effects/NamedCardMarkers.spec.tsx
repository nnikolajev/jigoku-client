import { describe, expect, it, afterEach, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import React from "react";

import NamedCardMarkers from "../../../../client/GameComponents/effects/NamedCardMarkers.jsx";

// The naming card renders with id={card.uuid}; jsdom reports a zero-sized rect for
// everything, which the anchor treats as "not on screen", so it has to be stubbed.
const planted: HTMLElement[] = [];

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
