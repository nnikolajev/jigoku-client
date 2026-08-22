import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import {
    getBotBenchmark,
    getRoundRobinMatchup,
    InnerNewGame,
    pretrainedBotDecks,
    sortDecksByRoundRobinAverage,
    standardBenchmarkSuite
} from "../../client/NewGame";

describe("the <InnerNewGame /> bot deck selector", () => {
    const enableBotOpponent = () => {
        fireEvent.click(screen.getByRole("radio", { name: "Imperial" }));
        fireEvent.click(screen.getByRole("checkbox", { name: "Human vs AI (only imperial)" }));
    };

    it("ignores benchmark sections recorded for a retired baseline suite", () => {
        const benchmark = getBotBenchmark({
            seeds: { "1": { winRates: { decks: { Crane: { wins: 99 } } } } }
        }, "v1", 1, "Crane");

        expect(benchmark.winRates).toBeUndefined();
    });

    it("orients round-robin records as bot wins against the player's deck", () => {
        const roundRobin = {
            matchups: [{
                left: "Crane", right: "Lion", leftWins: 12, rightWins: 28,
                other: 0, played: 40
            }]
        };

        expect(getRoundRobinMatchup(roundRobin, "Crane", "Lion")).toEqual({
            wins: 12, losses: 28, other: 0, played: 40, winRate: 0.3
        });
        expect(getRoundRobinMatchup(roundRobin, "Lion", "Crane")).toEqual({
            wins: 28, losses: 12, other: 0, played: 40, winRate: 0.7
        });
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
        expect(pretrainedBotDecks).toHaveLength(17);
        expect(new Set(pretrainedBotDecks.map((deck) => deck.benchmarkDeck)).size).toBe(pretrainedBotDecks.length);
        expect(new Set(pretrainedBotDecks.map((deck) => deck.url)).size).toBe(pretrainedBotDecks.length);
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

    it("pins the engine to Bot V1 and offers three strategy seeds and omniscience as independent controls", () => {
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
        expect(screen.queryByLabelText("Bot version")).not.toBeInTheDocument();
        const botType = screen.getByLabelText("Bot type");
        expect(within(botType).getByRole("option", { name: "mixed" })).toHaveValue("1");
        expect(within(botType).getByRole("option", { name: "dynasty focused" })).toHaveValue("2");
        expect(within(botType).getByRole("option", { name: "board-aware dynasty" })).toHaveValue("3");
        expect(within(botType).queryByRole("option", { name: /omniscient/i })).not.toBeInTheDocument();
        const omniscient = screen.getByRole("checkbox", { name: "Omniscient (sees hidden cards)" });
        expect(omniscient).not.toBeChecked();
        fireEvent.click(omniscient);
        expect(screen.getByText(/Balances dynasty development/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        expect(emit).toHaveBeenCalledWith("newgame", expect.objectContaining({
            bot: expect.objectContaining({
                enabled: true, engineVersion: "v1", seed: "1", omniscient: true
            })
        }));
        const [, payload] = emit.mock.calls[emit.mock.calls.length - 1];
        expect(payload.bot).not.toHaveProperty("v2Mode");
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
        expect(screen.getByText(/Adapts character purchases and fate investment to board power/)).toBeInTheDocument();
    });

    it("ranks the matchup matrix by average win rate, strongest bot first", () => {
        const roundRobin = {
            suiteId: standardBenchmarkSuite,
            gamesPerMatchup: 40,
            decks: {
                Crane: { wins: 450, losses: 450, other: 0, averageOpponentWinRate: 0.5, overallWinRate: 0.5 },
                Unicorn: { wins: 480, losses: 419, other: 1, averageOpponentWinRate: 0.534, overallWinRate: 0.534 },
                PhoenixShugenja: {
                    wins: 536, losses: 364, other: 0, averageOpponentWinRate: 0.596, overallWinRate: 0.596
                }
            },
            matchups: [{
                left: "Crane", right: "Unicorn", leftWins: 12, rightWins: 28, other: 0, played: 40
            }, {
                left: "Crane", right: "PhoenixShugenja", leftWins: 24, rightWins: 16, other: 0, played: 40
            }, {
                left: "Unicorn", right: "PhoenixShugenja", leftWins: 10, rightWins: 30, other: 0, played: 40
            }]
        };

        expect(sortDecksByRoundRobinAverage(roundRobin, pretrainedBotDecks.filter(
            (deck) => roundRobin.decks[deck.benchmarkDeck]
        )).map((deck) => deck.benchmarkDeck)).toEqual(["PhoenixShugenja", "Unicorn", "Crane"]);

        render(
            <InnerNewGame
                cancelNewGame={ vi.fn() }
                defaultGameName="Bot test"
                loadDecks={ vi.fn() }
                socket={ { emit: vi.fn() } }
                benchmarkResults={ { seeds: { "1": { roundRobin } } } }
            />
        );

        enableBotOpponent();
        fireEvent.click(screen.getByRole("button", { name: "Show bot win-rate matrix" }));

        const matchupMatrix = screen.getByRole("table", { name: "Bot win-rate matchup matrix" });
        const rows = within(matchupMatrix).getAllByRole("row").slice(1);
        expect(rows.map((row) => within(row).getByRole("rowheader").textContent)).toEqual([
            "Phoenix Shugenja",
            "[Precon15] Unicorn Military Rush (Temple)",
            "Crane Baseline"
        ]);
        expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(["1", "2", "3"]);
        expect(rows.map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual([
            "59.6%", "53.4%", "50.0%"
        ]);
        expect(within(matchupMatrix).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
            "#", "Bot opponent", "Avg", "PhoenixShugenja", "Unicorn", "Crane"
        ]);
    });

    it("shows generated Crane and round-robin results for the selected deck and seed", () => {
        const benchmarkResults = {
            seeds: {
                "1": {
                    winRates: {
                        suiteId: standardBenchmarkSuite,
                        gamesPerDeck: 100,
                        decks: {
                            Unicorn: { wins: 68, losses: 31, other: 1, winRate: 0.68 },
                            PhoenixShugenja: { wins: 72, losses: 28, other: 0, winRate: 0.72 }
                        }
                    },
                    roundRobin: {
                        suiteId: standardBenchmarkSuite,
                        gamesPerMatchup: 40,
                        decks: {
                            Crane: {
                                wins: 450,
                                losses: 450,
                                other: 0,
                                averageOpponentWinRate: 0.5,
                                overallWinRate: 0.5
                            },
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
                        },
                        matchups: [{
                            left: "Crane", right: "Unicorn", leftWins: 12,
                            rightWins: 28, other: 0, played: 40
                        }, {
                            left: "Crane", right: "PhoenixShugenja", leftWins: 24,
                            rightWins: 16, other: 0, played: 40
                        }, {
                            left: "Unicorn", right: "PhoenixShugenja", leftWins: 10,
                            rightWins: 30, other: 0, played: 40
                        }]
                    },
                    omniscient: {
                        suiteId: standardBenchmarkSuite,
                        gamesPerMatchup: 20,
                        decks: {
                            Unicorn: {
                                wins: 123, losses: 77, other: 0, winRate: 0.615, uplift: 0.08,
                                mirror: { wins: 12, losses: 8, other: 0, winRate: 0.6 }
                            },
                            PhoenixShugenja: { wins: 118, losses: 82, other: 0, winRate: 0.59 }
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
        const matchupToggle = screen.getByRole("button", { name: "Show bot win-rate matrix" });
        expect(matchupToggle).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("table", { name: "Bot win-rate matchup matrix" })).not.toBeInTheDocument();
        fireEvent.click(matchupToggle);
        expect(matchupToggle).toHaveAttribute("aria-expanded", "true");
        const matchupMatrix = screen.getByRole("table", { name: "Bot win-rate matchup matrix" });
        expect(within(matchupMatrix).getByLabelText(
            "[Precon15] Unicorn Military Rush (Temple) versus Crane Baseline: 70.0%"
        )).toHaveTextContent("70.0%");
        expect(within(matchupMatrix).getByLabelText(
            "Crane Baseline versus [Precon15] Unicorn Military Rush (Temple): 30.0%"
        )).toHaveTextContent("30.0%");
        expect(within(matchupMatrix).getByLabelText(
            "[Precon15] Unicorn Military Rush (Temple) versus [Precon15] Unicorn Military Rush (Temple): same deck"
        )).toHaveTextContent("—");
        fireEvent.click(screen.getByRole("checkbox", { name: "Omniscient (sees hidden cards)" }));
        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent(
            "Omniscient seed 1: 61.5% vs default pool (123-77), 8.0% uplift over normal [Precon15] Unicorn Military Rush (Temple); same-deck mirror 60.0% (12-8) (N=20/matchup)."
        );
        fireEvent.click(screen.getByRole("checkbox", { name: "Omniscient (sees hidden cards)" }));

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
            "No standardized Bot V1 benchmark recorded for seed 2 in fair mode."
        );
    });

    it("never mixes benchmark engine versions or information modes", () => {
        const benchmarkResults = {
            engines: {
                v1: { status: "default", seeds: { "1": { label: "v1 seed", winRates: {
                    suiteId: standardBenchmarkSuite, engineVersion: "v1", strategySeed: 1,
                    informationMode: "fair", gamesPerDeck: 100, decks: { Crane: { wins: 60, losses: 40, winRate: 0.6 } }
                }, omniscient: {
                    suiteId: standardBenchmarkSuite, engineVersion: "v1", strategySeed: 1,
                    informationMode: "omniscient", gamesPerMatchup: 40,
                    decks: { Crane: { wins: 28, losses: 12, winRate: 0.7 } }
                } } } },
                v2: { status: "experimental", seeds: { "1": { label: "v2 seed", winRates: {
                    suiteId: standardBenchmarkSuite, engineVersion: "v2", strategySeed: 1,
                    informationMode: "fair", gamesPerDeck: 20, decks: { Crane: { wins: 11, losses: 9, winRate: 0.55 } }
                }, omniscient: {
                    suiteId: standardBenchmarkSuite, engineVersion: "v2", strategySeed: 1,
                    informationMode: "omniscient", gamesPerMatchup: 20,
                    decks: { Crane: { wins: 12, losses: 8, winRate: 0.6 } }
                } } } }
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
        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent("60.0% (60-40, N=100)");
        // The lobby is pinned to Bot V1, so recorded V2 sections must never surface.
        expect(screen.getByLabelText("Standard bot benchmark")).not.toHaveTextContent("55.0% (11-9");
        fireEvent.click(screen.getByRole("checkbox", { name: "Omniscient (sees hidden cards)" }));
        expect(screen.getByLabelText("Standard bot benchmark")).toHaveTextContent("Omniscient seed 1: 70.0%");
        expect(screen.getByLabelText("Standard bot benchmark")).not.toHaveTextContent("Vs Crane Baseline");
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
