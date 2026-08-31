import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
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
