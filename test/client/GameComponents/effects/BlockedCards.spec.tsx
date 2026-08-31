import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import React from "react";

import BlockedCards from "../../../../client/GameComponents/effects/BlockedCards.jsx";

describe("the <BlockedCards /> sidebar strip", () => {
    it("renders nothing when no card is banned", () => {
        const { container } = render(<BlockedCards cards={ [] } />);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the banned card with a cancel mark", () => {
        const { container, getByAltText } = render(
            <BlockedCards cards={ [{ name: "Fine Katana", id: "fine-katana", packId: "core", sourceName: "Gossip" }] } />
        );
        expect(getByAltText("Fine Katana")).toBeInTheDocument();
        expect(container.querySelectorAll(".blocked-card__cancel")).toHaveLength(1);
    });

    it("names the card that applied the ban", () => {
        const { container } = render(
            <BlockedCards cards={ [{ name: "Fine Katana", id: "fine-katana", sourceName: "Gossip" }] } />
        );
        expect(container.querySelector(".blocked-card")?.getAttribute("title"))
            .toBe("Cannot play Fine Katana (Gossip)");
    });

    // A name nobody brought has no printing to draw, and the ban still has to read.
    it("falls back to the name when there is no picture", () => {
        const { getByText } = render(<BlockedCards cards={ [{ name: "Ancestral Daisho" }] } />);
        expect(getByText("Ancestral Daisho")).toBeInTheDocument();
    });

    // The ban is drawn tiny, so the only way to read the card is the board's own zoom
    // pane -- the same one every other card on the board hovers into.
    it("zooms the banned card on hover", () => {
        const onCardMouseOver = vi.fn();
        const onCardMouseOut = vi.fn();
        const card = { name: "Fine Katana", id: "fine-katana", packId: "core", sourceName: "Gossip" };
        const { container } = render(
            <BlockedCards cards={ [card] } onCardMouseOver={ onCardMouseOver } onCardMouseOut={ onCardMouseOut } />
        );
        const blocked = container.querySelector(".blocked-card");
        fireEvent.mouseOver(blocked);
        expect(onCardMouseOver).toHaveBeenCalledWith(card);
        fireEvent.mouseOut(blocked);
        expect(onCardMouseOut).toHaveBeenCalled();
    });

    // Nothing to zoom to when the name resolved to no printing.
    it("does not zoom a ban it has no picture for", () => {
        const onCardMouseOver = vi.fn();
        const { container } = render(
            <BlockedCards cards={ [{ name: "Ancestral Daisho" }] } onCardMouseOver={ onCardMouseOver } />
        );
        fireEvent.mouseOver(container.querySelector(".blocked-card"));
        expect(onCardMouseOver).not.toHaveBeenCalled();
    });

    it("shows one entry per ban", () => {
        const { container } = render(
            <BlockedCards cards={ [
                { name: "Fine Katana", id: "fine-katana", sourceName: "Gossip" },
                { name: "Assassination", id: "assassination", sourceName: "Dai Tsuchi" }
            ] } />
        );
        expect(container.querySelectorAll(".blocked-card")).toHaveLength(2);
    });
});
