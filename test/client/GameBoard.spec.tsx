import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

const gameSoundMocks = vi.hoisted(() => ({
    playCardPlay: vi.fn(),
    playMilitaryWin: vi.fn(),
    playPoliticalWin: vi.fn()
}));

vi.mock("../../client/GameComponents/effects/gameSounds.js", () => gameSoundMocks);

// Mock jQuery and its plugins
vi.mock("jquery", () => {
    const mockJQuery = vi.fn((selector) => ({
        addClass: vi.fn(),
        removeClass: vi.fn(),
        modal: vi.fn(),
        offset: vi.fn(() => ({ left: 0, top: 0 })),
        scrollTop: vi.fn()
    }));
    mockJQuery.fn = { jquery: "3.6.0" };
    return { default: mockJQuery };
});

// Mock react-redux-toastr
vi.mock("react-redux-toastr", () => ({
    toastr: {
        confirm: vi.fn()
    }
}));

// Mock react-draggable
vi.mock("react-draggable", () => ({
    default: ({ children }) => <div data-testid="draggable">{ children }</div>
}));

// Mock all the child components
vi.mock("../../client/GameComponents/PlayerStatsBox.jsx", () => ({
    default: () => <div data-testid="player-stats-box">PlayerStatsBox</div>
}));

vi.mock("../../client/GameComponents/PlayerStatsRow.jsx", () => ({
    default: () => <div data-testid="player-stats-row">PlayerStatsRow</div>
}));

vi.mock("../../client/GameComponents/PlayerHand.jsx", () => ({
    default: ({ cards }) => <div data-testid="player-hand">{ cards?.length || 0 } cards in hand</div>
}));

vi.mock("../../client/GameComponents/DynastyRow.jsx", () => ({
    default: () => <div data-testid="dynasty-row">DynastyRow</div>
}));

vi.mock("../../client/GameComponents/StrongholdRow.jsx", () => ({
    default: () => <div data-testid="stronghold-row">StrongholdRow</div>
}));

vi.mock("../../client/GameComponents/Ring.jsx", () => ({
    default: ({ ring }) => <div data-testid={ `ring-${ring.element}` }>{ ring.element }</div>
}));

vi.mock("../../client/GameComponents/HonorFan.jsx", () => ({
    default: ({ value }) => <div data-testid="honor-fan">{ value }</div>
}));

vi.mock("../../client/GameComponents/ActivePlayerPrompt.jsx", () => ({
    default: ({ title }) => <div data-testid="active-player-prompt">{ title }</div>
}));

vi.mock("../../client/Avatar.jsx", () => ({
    default: () => <div data-testid="avatar">Avatar</div>
}));

vi.mock("../../client/GameComponents/CardZoom.jsx", () => ({
    default: () => <div data-testid="card-zoom">CardZoom</div>
}));

vi.mock("../../client/GameComponents/Card.jsx", () => ({
    default: ({ card }) => <div data-testid="card">{ card?.name || "Card" }</div>
}));

vi.mock("../../client/GameComponents/Chat.jsx", () => ({
    default: () => <div data-testid="chat">Chat</div>
}));

vi.mock("../../client/GameComponents/Controls.jsx", () => ({
    default: ({ onTestAnimationClick, onToggleWinEffectsClick, animationTestVariant, winEffectsEnabled }) => (
        <div data-testid="controls">
            Controls
            <button
                aria-label={ `Test ${animationTestVariant} win animation` }
                onClick={ onTestAnimationClick }
            >Test animation</button>
            <button
                aria-label="Conflict win effects"
                aria-pressed={ winEffectsEnabled }
                onClick={ onToggleWinEffectsClick }
            >Toggle effects</button>
        </div>
    )
}));

vi.mock("../../client/GameComponents/CardPile.jsx", () => ({
    default: () => <div data-testid="card-pile">CardPile</div>
}));

vi.mock("../../client/GameComponents/GameConfiguration.jsx", () => ({
    default: () => <div data-testid="game-configuration">GameConfiguration</div>
}));

import { InnerGameBoard } from "../../client/GameBoard.jsx";

describe("the <GameBoard /> component", () => {
    let defaultProps;
    let mockPlayer;
    let mockRings;
    let mockConflict;

    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.removeItem("jigoku.conflictWinEffectsEnabled");
        mockRings = {
            air: { element: "air", removedFromGame: false, attachments: [] },
            earth: { element: "earth", removedFromGame: false, attachments: [] },
            fire: { element: "fire", removedFromGame: false, attachments: [] },
            void: { element: "void", removedFromGame: false, attachments: [] },
            water: { element: "water", removedFromGame: false, attachments: [] }
        };

        mockConflict = {
            attackingPlayerId: null,
            defendingPlayerId: null
        };

        mockPlayer = {
            id: "player1",
            name: "TestPlayer",
            user: {
                username: "TestPlayer",
                emailHash: "abc123"
            },
            cardPiles: {
                hand: [{ uuid: "1", name: "Card 1" }, { uuid: "2", name: "Card 2" }],
                cardsInPlay: [],
                conflictDiscardPile: [],
                conflictDeck: [],
                dynastyDiscardPile: [],
                dynastyDeck: [],
                provinceDeck: [],
                removedFromGame: []
            },
            provinces: {
                one: [],
                two: [],
                three: [],
                four: []
            },
            strongholdProvince: [],
            role: null,
            stats: { fate: 5, honor: 10 },
            clock: { mode: "off" },
            buttons: [],
            promptedActionWindows: {},
            timerSettings: {},
            optionSettings: { showStatusInSidebar: true }
        };

        defaultProps = {
            currentGame: {
                players: {
                    TestPlayer: mockPlayer
                },
                spectators: [],
                messages: [],
                rings: mockRings,
                conflict: mockConflict,
                manualMode: false,
                started: true
            },
            username: "TestPlayer",
            user: {
                settings: {
                    cardSize: "normal",
                    optionSettings: { disableCardStats: false }
                }
            },
            cards: {},
            cardToZoom: null,
            socket: {},
            dispatch: vi.fn(),
            sendGameMessage: vi.fn(),
            closeGameSocket: vi.fn(),
            setContextMenu: vi.fn(),
            zoomCard: vi.fn(),
            clearZoom: vi.fn()
        };
    });

    describe("when currentGame is not provided", () => {
        it("should display waiting message", () => {
            render(<InnerGameBoard { ...defaultProps } currentGame={ null } />);
            expect(screen.getByText("Waiting for server...")).toBeInTheDocument();
        });
    });

    describe("when there are no players", () => {
        it("should display waiting for players message", () => {
            render(<InnerGameBoard { ...defaultProps } currentGame={ { ...defaultProps.currentGame, players: {} } } />);
            expect(screen.getByText("Waiting for game to have players or close...")).toBeInTheDocument();
        });
    });

    describe("when rendered with a valid game", () => {
        beforeEach(() => {
            render(<InnerGameBoard { ...defaultProps } />);
        });

        it("should render the game board", () => {
            expect(document.querySelector(".game-board")).toBeInTheDocument();
        });

        it("should render the active player prompt", () => {
            expect(screen.getByTestId("active-player-prompt")).toBeInTheDocument();
        });

        it("should render the chat component", () => {
            expect(screen.getByTestId("chat")).toBeInTheDocument();
        });

        it("should render the controls component", () => {
            expect(screen.getByTestId("controls")).toBeInTheDocument();
        });

        it("should render the card zoom component", () => {
            expect(screen.getByTestId("card-zoom")).toBeInTheDocument();
        });

        it("should render the rings", () => {
            // Rings are rendered in the center bar
            expect(screen.getAllByTestId("ring-air").length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByTestId("ring-earth").length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByTestId("ring-fire").length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByTestId("ring-void").length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByTestId("ring-water").length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("when user is a spectator", () => {
        beforeEach(() => {
            render(<InnerGameBoard { ...defaultProps } username="SpectatorUser" />);
        });

        it("should render the game board", () => {
            expect(document.querySelector(".game-board")).toBeInTheDocument();
        });
    });

    describe("when there are two players", () => {
        beforeEach(() => {
            const otherPlayer = {
                ...mockPlayer,
                id: "player2",
                name: "OtherPlayer",
                user: {
                    username: "OtherPlayer",
                    emailHash: "def456"
                }
            };

            render(
                <InnerGameBoard
                    { ...defaultProps }
                    currentGame={ {
                        ...defaultProps.currentGame,
                        players: {
                            TestPlayer: mockPlayer,
                            OtherPlayer: otherPlayer
                        }
                    } }
                />
            );
        });

        it("should render the game board", () => {
            expect(document.querySelector(".game-board")).toBeInTheDocument();
        });

        it("should render dynasty rows for both players", () => {
            const dynastyRows = screen.getAllByTestId("dynasty-row");
            expect(dynastyRows.length).toBe(2);
        });

        it("should render stronghold rows for both players", () => {
            const strongholdRows = screen.getAllByTestId("stronghold-row");
            expect(strongholdRows.length).toBe(2);
        });
    });

    describe("when a ring is removed from game", () => {
        beforeEach(() => {
            const ringsWithRemoved = {
                ...mockRings,
                air: { element: "air", removedFromGame: true, attachments: [] }
            };

            render(
                <InnerGameBoard
                    { ...defaultProps }
                    currentGame={ {
                        ...defaultProps.currentGame,
                        rings: ringsWithRemoved
                    } }
                />
            );
        });

        it("should show the removed rings section", () => {
            // The air ring should be in the removed section
            const removedRingsSection = document.querySelector(".removed-rings");
            expect(removedRingsSection).toBeInTheDocument();
        });
    });

    describe("when in manual mode", () => {
        beforeEach(() => {
            render(
                <InnerGameBoard
                    { ...defaultProps }
                    currentGame={ {
                        ...defaultProps.currentGame,
                        manualMode: true
                    } }
                />
            );
        });

        it("should render the game board", () => {
            expect(document.querySelector(".game-board")).toBeInTheDocument();
        });
    });

    describe("when there is an active conflict", () => {
        beforeEach(() => {
            const activeConflict = {
                attackingPlayerId: "player1",
                defendingPlayerId: "player2",
                attackerSkill: 5,
                defenderSkill: 3,
                type: "military",
                elements: ["fire"]
            };

            render(
                <InnerGameBoard
                    { ...defaultProps }
                    currentGame={ {
                        ...defaultProps.currentGame,
                        conflict: activeConflict
                    } }
                />
            );
        });

        it("should render the conflict panel", () => {
            const conflictPanel = document.querySelector(".conflict-panel");
            expect(conflictPanel).toBeInTheDocument();
        });

        it("should display skill values", () => {
            expect(screen.getByText("5")).toBeInTheDocument();
        });
    });

    describe("when a high-skill conflict resolves", () => {
        function gameWithProvince(conflict, isBroken) {
            return {
                ...defaultProps.currentGame,
                name: "Animation Test",
                conflict,
                players: {
                    TestPlayer: {
                        ...mockPlayer,
                        provinces: {
                            ...mockPlayer.provinces,
                            one: [{ uuid: "province-1", isProvince: true, isBroken }]
                        }
                    }
                }
            };
        }

        it("shows the political fan as soon as the province becomes broken", () => {
            const conflict = {
                type: "political",
                attackerSkill: 6,
                defenderSkill: 0,
                declarationComplete: true
            };
            const activeGame = {
                ...defaultProps.currentGame,
                name: "Animation Test",
                conflict,
                players: {
                    TestPlayer: {
                        ...mockPlayer,
                        provinces: {
                            ...mockPlayer.provinces,
                            one: [{ uuid: "province-1", isProvince: true, isBroken: false }]
                        }
                    }
                }
            };
            const { rerender } = render(
                <InnerGameBoard { ...defaultProps } currentGame={ activeGame } />
            );

            rerender(
                <InnerGameBoard
                    { ...defaultProps }
                    currentGame={ {
                        ...activeGame,
                        players: {
                            TestPlayer: {
                                ...activeGame.players.TestPlayer,
                                provinces: {
                                    ...activeGame.players.TestPlayer.provinces,
                                    one: [{ uuid: "province-1", isProvince: true, isBroken: true }]
                                }
                            }
                        }
                    } } />
            );

            expect(document.querySelector(".conflict-slam--political")).toBeInTheDocument();
            expect(document.querySelector(".conflict-slam__fan")).toBeInTheDocument();
            expect(document.querySelector(".conflict-slam__wind")).toBeInTheDocument();
            expect(document.querySelector(".game-board")).not.toHaveClass("screen-shake");
            expect(gameSoundMocks.playPoliticalWin).toHaveBeenCalledOnce();
            expect(gameSoundMocks.playMilitaryWin).not.toHaveBeenCalled();
        });

        it("shows the conflict slam at a 5-skill winning margin", () => {
            const conflict = {
                type: "military",
                attackerSkill: 7,
                defenderSkill: 2,
                declarationComplete: true
            };
            const activeGame = {
                ...defaultProps.currentGame,
                name: "Animation Test",
                conflict,
                players: {
                    TestPlayer: {
                        ...mockPlayer,
                        provinces: {
                            ...mockPlayer.provinces,
                            one: [{ uuid: "province-1", isProvince: true, isBroken: false }]
                        }
                    }
                }
            };
            const { rerender } = render(
                <InnerGameBoard { ...defaultProps } currentGame={ activeGame } />
            );

            rerender(
                <InnerGameBoard
                    { ...defaultProps }
                    currentGame={ {
                        ...activeGame,
                        players: {
                            TestPlayer: {
                                ...activeGame.players.TestPlayer,
                                provinces: {
                                    ...activeGame.players.TestPlayer.provinces,
                                    one: [{ uuid: "province-1", isProvince: true, isBroken: true }]
                                }
                            }
                        }
                    } } />
            );

            expect(document.querySelector(".conflict-slam--military")).toBeInTheDocument();
            expect(document.querySelectorAll(".conflict-slam__slash")).toHaveLength(2);
            expect(document.querySelector(".conflict-slam__fist")).toBeInTheDocument();
            expect(document.querySelector(".game-board")).toHaveClass("screen-shake");
            expect(gameSoundMocks.playMilitaryWin).toHaveBeenCalledOnce();
            expect(gameSoundMocks.playPoliticalWin).not.toHaveBeenCalled();
        });

        it("does not show the conflict slam below a 5-skill winning margin", () => {
            const conflict = {
                type: "military",
                attackerSkill: 5,
                defenderSkill: 2,
                declarationComplete: true
            };
            const activeGame = {
                ...defaultProps.currentGame,
                name: "Animation Test",
                conflict,
                players: {
                    TestPlayer: {
                        ...mockPlayer,
                        provinces: {
                            ...mockPlayer.provinces,
                            one: [{ uuid: "province-1", isProvince: true, isBroken: false }]
                        }
                    }
                }
            };
            const { rerender } = render(
                <InnerGameBoard { ...defaultProps } currentGame={ activeGame } />
            );

            rerender(
                <InnerGameBoard
                    { ...defaultProps }
                    currentGame={ {
                        ...activeGame,
                        players: {
                            TestPlayer: {
                                ...activeGame.players.TestPlayer,
                                provinces: {
                                    ...activeGame.players.TestPlayer.provinces,
                                    one: [{ uuid: "province-1", isProvince: true, isBroken: true }]
                                }
                            }
                        }
                    } } />
            );

            expect(document.querySelector(".conflict-slam")).not.toBeInTheDocument();
            expect(gameSoundMocks.playMilitaryWin).not.toHaveBeenCalled();
            expect(gameSoundMocks.playPoliticalWin).not.toHaveBeenCalled();
        });

        it("does not play automatic win effects after they are turned off", () => {
            const conflict = {
                type: "military",
                attackerSkill: 7,
                defenderSkill: 1,
                declarationComplete: true
            };
            const activeGame = gameWithProvince(conflict, false);
            const { rerender } = render(<InnerGameBoard { ...defaultProps } currentGame={ activeGame } />);

            fireEvent.click(screen.getByRole("button", { name: "Conflict win effects" }));
            expect(screen.getByRole("button", { name: "Conflict win effects" })).toHaveAttribute("aria-pressed", "false");

            rerender(
                <InnerGameBoard
                    { ...defaultProps }
                    currentGame={ gameWithProvince(conflict, true) } />
            );

            expect(document.querySelector(".conflict-slam")).not.toBeInTheDocument();
            expect(gameSoundMocks.playMilitaryWin).not.toHaveBeenCalled();
            expect(gameSoundMocks.playPoliticalWin).not.toHaveBeenCalled();
            expect(window.localStorage.getItem("jigoku.conflictWinEffectsEnabled")).toBe("false");
        });
    });

    describe("animation test control", () => {
        it("alternates military and political animations from one button", () => {
            render(<InnerGameBoard { ...defaultProps } />);

            fireEvent.click(screen.getByRole("button", { name: "Test military win animation" }));
            expect(document.querySelector(".conflict-slam--military")).toBeInTheDocument();
            expect(document.querySelector(".conflict-slam__fist")).toBeInTheDocument();

            fireEvent.click(screen.getByRole("button", { name: "Test political win animation" }));
            expect(document.querySelector(".conflict-slam--political")).toBeInTheDocument();
            expect(document.querySelector(".conflict-slam__fan")).toBeInTheDocument();
        });

        it("clears an active animation and remembers when win effects are turned off", () => {
            const { unmount } = render(<InnerGameBoard { ...defaultProps } />);

            fireEvent.click(screen.getByRole("button", { name: "Test military win animation" }));
            expect(document.querySelector(".conflict-slam")).toBeInTheDocument();

            fireEvent.click(screen.getByRole("button", { name: "Conflict win effects" }));
            expect(document.querySelector(".conflict-slam")).not.toBeInTheDocument();
            expect(window.localStorage.getItem("jigoku.conflictWinEffectsEnabled")).toBe("false");

            unmount();
            render(<InnerGameBoard { ...defaultProps } />);
            expect(screen.getByRole("button", { name: "Conflict win effects" })).toHaveAttribute("aria-pressed", "false");
        });
    });

    describe("player hand", () => {
        it("should render player hand for the current player", () => {
            render(<InnerGameBoard { ...defaultProps } />);
            expect(screen.getByTestId("player-hand")).toBeInTheDocument();
            expect(screen.getByText("2 cards in hand")).toBeInTheDocument();
        });
    });
});
