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

    it("offers fate-aware seed 1 by default and submits it to the lobby", () => {
        const emit = vi.fn();
        render(
            <InnerNewGame
                cancelNewGame={ vi.fn() }
                defaultGameName="Bot test"
                loadDecks={ vi.fn() }
                socket={ { emit } }
            />
        );

        fireEvent.click(screen.getByRole("checkbox", { name: "Human vs AI" }));
        const difficulty = screen.getByLabelText("Bot difficulty");
        expect(within(difficulty).getByRole("option", { name: "Fate-aware heuristic (default)" })).toHaveValue("1");
        expect(within(difficulty).getByRole("option", { name: "Old heuristic" })).toHaveValue("2");
        expect(within(difficulty).queryByRole("option", { name: "LLM-driven (experimental)" })).not.toBeInTheDocument();
        expect(within(difficulty).queryByRole("option", { name: "Self-play ML (experimental)" })).not.toBeInTheDocument();
        expect(within(difficulty).getByRole("option", { name: "Omniscient (cheating — hardest)" })).toHaveValue("5");
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        expect(emit).toHaveBeenCalledWith("newgame", expect.objectContaining({
            bot: expect.objectContaining({ enabled: true, seed: "1" })
        }));
    });

    it("shows generated Crane and round-robin results for the selected deck and seed", () => {
        const benchmarkResults = {
            seeds: {
                "1": {
                    winRates: {
                        gamesPerDeck: 100,
                        decks: {
                            Unicorn: { wins: 68, losses: 31, other: 1, winRate: 0.68 },
                            PhoenixShugenja: { wins: 72, losses: 28, other: 0, winRate: 0.72 }
                        }
                    },
                    roundRobin: {
                        gamesPerMatchup: 100,
                        decks: {
                            Unicorn: {
                                wins: 480,
                                losses: 419,
                                other: 1,
                                averageOpponentWinRate: 0.534,
                                overallWinRate: 0.534
                            },
                            PhoenixShugenja: {
                                wins: 536,
                                losses: 364,
                                other: 0,
                                averageOpponentWinRate: 0.596,
                                overallWinRate: 0.596
                            }
                        }
                    }
                }
            }
        };
        render(
            <InnerNewGame
                cancelNewGame={ vi.fn() }
                defaultGameName="Bot test"
                loadDecks={ vi.fn() }
                socket={ { emit: vi.fn() } }
                benchmarkResults={ benchmarkResults }
            />
        );

        fireEvent.click(screen.getByRole("checkbox", { name: "Human vs AI" }));

        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent(
            "Vs Crane: 68.0% (68-31, N=100)."
        );
        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent(
            "Round robin: 53.4% average vs opponents, 53.4% overall (480-419, N=100/matchup)."
        );

        fireEvent.change(screen.getByLabelText("Bot deck"), {
            target: { value: "https://www.emeralddb.org/decks/b260d778-0016-4d70-b1f9-5180daf340fc" }
        });
        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent(
            "Vs Crane: 72.0% (72-28, N=100)."
        );
        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent(
            "Round robin: 59.6% average vs opponents, 59.6% overall (536-364, N=100/matchup)."
        );

        fireEvent.change(screen.getByLabelText("Bot difficulty"), { target: { value: "2" } });
        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent(
            "No standardized 100-game benchmark recorded for this seed."
        );
    });
});
