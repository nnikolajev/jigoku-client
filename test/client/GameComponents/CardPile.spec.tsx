import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import CardPile from "../../../client/GameComponents/CardPile.jsx";

describe("the <CardPile /> component", () => {
    it("should glow a low deck count red", () => {
        render(
            <CardPile
                cards={ [] }
                cardCount={ 5 }
                lowCardCountWarningEnabled
                source="conflict deck"
                title="Conflict"
            />
        );

        expect(screen.getByText("5")).toHaveClass("visual-suggestion--negative");
    });

    it("should remove the glow when the deck rises above five cards", () => {
        const { rerender } = render(
            <CardPile
                cards={ [] }
                cardCount={ 5 }
                lowCardCountWarningEnabled
                source="dynasty deck"
                title="Dynasty"
            />
        );

        rerender(
            <CardPile
                cards={ [] }
                cardCount={ 6 }
                lowCardCountWarningEnabled
                source="dynasty deck"
                title="Dynasty"
            />
        );

        expect(screen.getByText("6")).not.toHaveClass("visual-suggestion");
    });

    it("should preserve and highlight an empty deck count", () => {
        render(
            <CardPile
                cards={ [{ uuid: "hidden-card" }] }
                cardCount={ 0 }
                lowCardCountWarningEnabled
                source="conflict deck"
                title="Conflict"
            />
        );

        expect(screen.getByText("0")).toHaveClass("visual-suggestion--negative");
    });

    it("should not glow when visual suggestions are disabled", () => {
        render(
            <CardPile
                cards={ [] }
                cardCount={ 5 }
                lowCardCountWarningEnabled={ false }
                source="conflict deck"
                title="Conflict"
            />
        );

        expect(screen.getByText("5")).not.toHaveClass("visual-suggestion");
    });
});
