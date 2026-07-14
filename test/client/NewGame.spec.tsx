import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { InnerNewGame, pretrainedBotDecks } from "../../client/NewGame";

describe("the <InnerNewGame /> bot deck selector", () => {
    it("lists every trained bot deck, including the two tower-era additions", () => {
        render(
            <InnerNewGame
                cancelNewGame={ vi.fn() }
                defaultGameName="Bot test"
                loadDecks={ vi.fn() }
                socket={ { emit: vi.fn() } }
            />
        );

        fireEvent.click(screen.getByRole("checkbox", { name: "Human vs AI" }));

        const botDeckSelect = screen.getByLabelText("Bot deck");
        expect(within(botDeckSelect).getByRole("option", { name: "Phoenix Shugenja" })).toHaveValue(
            "https://www.emeralddb.org/decks/b260d778-0016-4d70-b1f9-5180daf340fc"
        );
        expect(within(botDeckSelect).getByRole("option", { name: "Dragon Attachments" })).toHaveValue(
            "https://www.emeralddb.org/decks/46aaa220-2cf9-463b-bdf3-3019572432ff"
        );
        expect(pretrainedBotDecks).toHaveLength(10);
    });
});
