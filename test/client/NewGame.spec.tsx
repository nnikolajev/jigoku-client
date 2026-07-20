import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { getBotBenchmark, InnerNewGame, pretrainedBotDecks } from "../../client/NewGame";

describe("the <InnerNewGame /> bot deck selector", () => {
    const enableBotOpponent = () => {
        fireEvent.click(screen.getByRole("radio", { name: "Imperial" }));
        fireEvent.click(screen.getByRole("checkbox", { name: "Human vs AI (only imperial)" }));
    };

    it("ignores benchmark sections recorded for a retired baseline suite", () => {
        const benchmark = getBotBenchmark({
            seeds: { "1": { winRates: { decks: { Crane: { wins: 99 } } } } }
        }, 1, "Crane");

        expect(benchmark.winRates).toBeUndefined();
    });

    it("lists every benchmarked bot deck with one option per deck", () => {
        render(
            <InnerNewGame
                cancelNewGame={ vi.fn() }
                defaultGameName="Bot test"
                loadDecks={ vi.fn() }
                socket={ { emit: vi.fn() } }
            />
        );

        enableBotOpponent();

        const botDeckSelect = screen.getByLabelText("Bot deck");
        expect(within(botDeckSelect).getByRole("option", { name: "Crane Baseline" })).toHaveValue(
            "https://www.emeralddb.org/decks/4736f7c0-b4a6-4f17-9dde-b71614115c69"
        );
        expect(within(botDeckSelect).getByRole("option", { name: "Phoenix Shugenja" })).toHaveValue(
            "https://www.emeralddb.org/decks/b260d778-0016-4d70-b1f9-5180daf340fc"
        );
        expect(within(botDeckSelect).getByRole("option", { name: "Dragon Attachments" })).toHaveValue(
            "https://www.emeralddb.org/decks/46aaa220-2cf9-463b-bdf3-3019572432ff"
        );
        expect(pretrainedBotDecks).toHaveLength(10);
        expect(new Set(pretrainedBotDecks.map((deck) => deck.benchmarkDeck)).size).toBe(10);
        expect(new Set(pretrainedBotDecks.map((deck) => deck.url)).size).toBe(10);
    });

    it("submits every pretrained bot deck, including the unchanged first option", () => {
        const emit = vi.fn();
        render(
            <InnerNewGame
                cancelNewGame={ vi.fn() }
                defaultGameName="Bot test"
                loadDecks={ vi.fn() }
                socket={ { emit } }
            />
        );

        enableBotOpponent();
        const botDeckSelect = screen.getByLabelText("Bot deck");

        pretrainedBotDecks.forEach((deck, index) => {
            if(index > 0) {
                fireEvent.change(botDeckSelect, { target: { value: deck.url } });
            }
            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            expect(emit).toHaveBeenLastCalledWith("newgame", expect.objectContaining({
                bot: expect.objectContaining({ enabled: true, deckId: deck.url })
            }));
        });
    });

    it("offers the four bot types and submits mixed seed 1 by default", () => {
        const emit = vi.fn();
        render(
            <InnerNewGame
                cancelNewGame={ vi.fn() }
                defaultGameName="Bot test"
                loadDecks={ vi.fn() }
                socket={ { emit } }
            />
        );

        enableBotOpponent();
        const botType = screen.getByLabelText("Bot type");
        expect(within(botType).getByRole("option", { name: "mixed" })).toHaveValue("1");
        expect(within(botType).getByRole("option", { name: "dynasty focused" })).toHaveValue("2");
        expect(within(botType).getByRole("option", { name: "omniscient (sees hidden cards)" })).toHaveValue("3");
        expect(within(botType).getByRole("option", { name: "board-aware dynasty" })).toHaveValue("4");
        expect(screen.getByText(/Balances dynasty development/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        expect(emit).toHaveBeenCalledWith("newgame", expect.objectContaining({
            bot: expect.objectContaining({ enabled: true, seed: "1" })
        }));
    });

    it("updates bot focus text and exposes the selected deck link", () => {
        render(
            <InnerNewGame
                cancelNewGame={ vi.fn() }
                defaultGameName="Bot test"
                loadDecks={ vi.fn() }
                socket={ { emit: vi.fn() } }
            />
        );

        enableBotOpponent();

        expect(screen.getByRole("link", { name: pretrainedBotDecks[0].url })).toHaveAttribute("href", pretrainedBotDecks[0].url);

        fireEvent.change(screen.getByLabelText("Bot type"), { target: { value: "2" } });
        expect(screen.getByText(/Focuses on dynasty purchases/)).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Bot type"), { target: { value: "3" } });
        expect(screen.getByText(/hidden information from your hand and face-down provinces/)).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Bot type"), { target: { value: "4" } });
        expect(screen.getByText(/Adapts character purchases and fate investment to board power/)).toBeInTheDocument();
    });

    it("shows generated Crane and round-robin results for the selected deck and seed", () => {
        const benchmarkResults = {
            seeds: {
                "1": {
                    winRates: {
                        suiteId: "crane-baseline-4736f7c0",
                        gamesPerDeck: 100,
                        decks: {
                            Unicorn: { wins: 68, losses: 31, other: 1, winRate: 0.68 },
                            PhoenixShugenja: { wins: 72, losses: 28, other: 0, winRate: 0.72 }
                        }
                    },
                    roundRobin: {
                        suiteId: "crane-baseline-4736f7c0",
                        gamesPerMatchup: 40,
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

        enableBotOpponent();
        fireEvent.change(screen.getByLabelText("Bot deck"), {
            target: { value: "https://www.emeralddb.org/decks/52b78858-fce5-431a-a3e5-be4f2a921ed9" }
        });

        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent(
            "Vs Crane Baseline: 68.0% (68-31, N=100)."
        );
        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent(
            "Round robin: 53.4% average vs opponents, 53.4% overall (480-419, N=40/matchup)."
        );

        fireEvent.change(screen.getByLabelText("Bot deck"), {
            target: { value: "https://www.emeralddb.org/decks/b260d778-0016-4d70-b1f9-5180daf340fc" }
        });
        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent(
            "Vs Crane Baseline: 72.0% (72-28, N=100)."
        );
        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent(
            "Round robin: 59.6% average vs opponents, 59.6% overall (536-364, N=40/matchup)."
        );

        fireEvent.change(screen.getByLabelText("Bot type"), { target: { value: "2" } });
        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent(
            "No standardized benchmark recorded for this seed."
        );
    });

    it("only enables Human vs AI for Imperial games", () => {
        const emit = vi.fn();
        render(
            <InnerNewGame
                cancelNewGame={ vi.fn() }
                defaultGameName="Bot test"
                loadDecks={ vi.fn() }
                socket={ { emit } }
            />
        );

        const botCheckbox = screen.getByRole("checkbox", { name: "Human vs AI (only imperial)" });
        expect(botCheckbox).toBeDisabled();

        fireEvent.click(screen.getByRole("radio", { name: "Imperial" }));
        expect(botCheckbox).toBeEnabled();
        fireEvent.click(botCheckbox);
        expect(botCheckbox).toBeChecked();

        fireEvent.click(screen.getByRole("radio", { name: "Emerald" }));
        expect(botCheckbox).toBeDisabled();
        expect(botCheckbox).not.toBeChecked();

        fireEvent.click(screen.getByRole("button", { name: "Submit" }));
        expect(emit).toHaveBeenCalledWith("newgame", expect.objectContaining({
            bot: expect.objectContaining({ enabled: false })
        }));
    });
});
