import { useState } from "react";
import { connect } from "react-redux";
import GameModes from "./GameModes";
import botBenchmarkResults from "./botBenchmarkResults.json";

import * as actions from "./actions";

// Must match tools/selfplay/standardBenchmark.js. A new baseline deck makes
// old standardized results incomparable, so unmatched sections stay hidden.
export const standardBenchmarkSuite = "crane-baseline-4736f7c0";

const defaultTime = {
    timer: "60",
    chess: "40",
    hourglass: "15",
    byoyomi: "0"
};

// Decks with hand-written bot playbooks (jigoku CardPlaybook.ts). The lobby
// accepts either an EmeraldDB URL or a local deck id, so the dropdown just
// fills the same field a custom URL would.
export const pretrainedBotDecks = [
    {
        label: "Crane Baseline",
        url: "https://www.emeralddb.org/decks/4736f7c0-b4a6-4f17-9dde-b71614115c69",
        benchmarkDeck: "Crane"
    },
    {
        label: "[Precon15] Unicorn Military Rush (Temple)",
        url: "https://www.emeralddb.org/decks/52b78858-fce5-431a-a3e5-be4f2a921ed9",
        benchmarkDeck: "Unicorn"
    },
    {
        label: "[Precon15] Crab Defense (Flooded Waste)",
        url: "https://www.emeralddb.org/decks/61eedd28-17ee-4547-9ccd-3a9655198227",
        benchmarkDeck: "Crab"
    },
    {
        label: "Scorpion Poison Mill (dishonor)",
        url: "https://www.emeralddb.org/decks/914dc4d4-a63b-4a86-af15-e46ba55361fc",
        benchmarkDeck: "Scorpion"
    },
    {
        label: "[Precon15] Lion Bushi (swarm, Rich Frog)",
        url: "https://www.emeralddb.org/decks/27a913d1-6a68-4641-a953-80a6ca373005",
        benchmarkDeck: "Lion"
    },
    {
        label: "Phoenix For Honor and Glory",
        url: "https://www.emeralddb.org/decks/7c5b9776-046d-4bc3-bd62-209b1cf4efa9",
        benchmarkDeck: "Phoenix"
    },
    {
        label: "Dragon Monks (Togashi Mitsu)",
        url: "https://www.emeralddb.org/decks/4fb91e58-9c3b-47e1-983e-133e0a4d9254",
        benchmarkDeck: "Dragon"
    },
    {
        label: "Crane Duels (upgraded, Tsuma)",
        url: "https://www.emeralddb.org/decks/8a125b59-cfe0-4546-8b74-d5151ba5c710",
        benchmarkDeck: "CraneDuels"
    },
    {
        label: "Phoenix Shugenja",
        url: "https://www.emeralddb.org/decks/b260d778-0016-4d70-b1f9-5180daf340fc",
        benchmarkDeck: "PhoenixShugenja"
    },
    {
        label: "Dragon Attachments",
        url: "https://www.emeralddb.org/decks/46aaa220-2cf9-463b-bdf3-3019572432ff",
        benchmarkDeck: "DragonAttachments"
    }
];
const customBotDeck = "custom";

// Player-facing bot types. Values pass straight to JigokuBotController.
const botSeedOptions = [
    {
        value: "1",
        label: "mixed",
        desc: "Balances dynasty development, fate efficiency, conflicts, ring value, and deck-specific tactics."
    },
    {
        value: "2",
        label: "dynasty focused",
        desc: "Focuses on dynasty purchases and building a wide board, spending fate more aggressively before conflicts."
    },
    {
        value: "5",
        label: "omniscient (sees hidden cards)",
        desc: "Uses hidden information from your hand and face-down provinces to choose attacks, defenses, and conflict actions."
    }
];
export function getBotBenchmark(results, seed, benchmarkDeck) {
    const seedResult = results?.seeds?.[String(seed)];
    const winRates = seedResult?.winRates?.suiteId === standardBenchmarkSuite
        ? seedResult.winRates
        : undefined;
    const roundRobin = seedResult?.roundRobin?.suiteId === standardBenchmarkSuite
        ? seedResult.roundRobin
        : undefined;
    return {
        seedLabel: seedResult?.label,
        winRates: winRates?.decks?.[benchmarkDeck],
        winRateGames: winRates?.gamesPerDeck,
        roundRobin: roundRobin?.decks?.[benchmarkDeck],
        roundRobinGames: roundRobin?.gamesPerMatchup
    };
}

function percentage(rate) {
    return rate === null || rate === undefined ? "--" : `${(rate * 100).toFixed(1)}%`;
}

export function InnerNewGame({ cancelNewGame, defaultGameName, loadDecks, socket, benchmarkResults = botBenchmarkResults }) {
    const [spectators, setSpectators] = useState(true);
    const [spectatorSquelch, setSpectatorSquelch] = useState(false);
    const [selectedGameMode, setSelectedGameMode] = useState(GameModes.Emerald);
    const [clocks, setClocks] = useState(false);
    const [selectedClockType, setSelectedClockType] = useState("timer");
    const [clockTimer, setClockTimer] = useState(60);
    const [byoyomiPeriods, setByoyomiPeriods] = useState(5);
    const [byoyomiTimePeriod, setByoyomiTimePeriod] = useState(30);
    const [selectedGameType, setSelectedGameType] = useState("casual");
    const [password, setPassword] = useState("");
    const [gameName, setGameName] = useState(defaultGameName || "");
    const [botOpponent, setBotOpponent] = useState(false);
    const [botDeckChoice, setBotDeckChoice] = useState(pretrainedBotDecks[0].url);
    const [botDeckId, setBotDeckId] = useState("");
    const [botSeed, setBotSeed] = useState("1");

    const handleCancelClick = (event) => {
        event.preventDefault();
        cancelNewGame();
    };

    const handleNameChange = (event) => {
        setGameName(event.target.value.substr(0, 140));
    };

    const handlePasswordChange = (event) => {
        setPassword(event.target.value);
    };

    const handleSpectatorsClick = (event) => {
        setSpectators(event.target.checked);
    };

    const handleSpectatorSquelchClick = (event) => {
        setSpectatorSquelch(event.target.checked);
    };

    const handleClockClick = (event) => {
        setClocks(event.target.checked);
    };

    const handleBotOpponentClick = (event) => {
        setBotOpponent(event.target.checked);
    };

    const handleSubmitClick = (event) => {
        event.preventDefault();

        const clockConfig = {
            type: clocks ? selectedClockType : "none",
            time: clocks ? clockTimer : 0,
            periods: clocks ? byoyomiPeriods : 0,
            timePeriod: clocks ? byoyomiTimePeriod : 0
        };

        socket.emit("newgame", {
            name: gameName,
            spectators: spectators,
            spectatorSquelch: spectatorSquelch,
            gameType: selectedGameType,
            skirmishMode: selectedGameMode === GameModes.Skirmish, //TODO: Legacy support, remove in a bit
            gameMode: selectedGameMode,
            clocks: clockConfig,
            password: password,
            bot: {
                enabled: botOpponent,
                deckId: botDeckChoice === customBotDeck ? botDeckId.trim() : botDeckChoice,
                seed: botSeed.trim()
            }
        });

        loadDecks(selectedGameMode);
    };

    const handleRadioChange = (gameType) => {
        setSelectedGameType(gameType);
    };

    const handleRulesRadioChange = (gameMode) => {
        setSelectedGameMode(gameMode);
        if(gameMode !== GameModes.Stronghold) {
            setBotOpponent(false);
        }
    };

    const handleClockRadioChange = (clockType) => {
        setSelectedClockType(clockType);
        setClockTimer(defaultTime[clockType]);
    };

    const isGameTypeSelected = (gameType) => {
        return selectedGameType === gameType;
    };

    const isGameModeSelected = (gameMode) => {
        return selectedGameMode === gameMode;
    };

    const isClockTypeSelected = (clockType) => {
        return selectedClockType === clockType;
    };

    const getClockInput = () => {
        return (
            <div>
                <div className="row game-password">
                    <div className="col-sm-12">
                        <b>Clocks</b>
                    </div>
                    <div className="col-sm-10">
                        <label className="radio-inline">
                            <input type="radio" onChange={ () => handleClockRadioChange("timer") } checked={ isClockTypeSelected("timer") } />
                            Timer
                        </label>
                        <label className="radio-inline">
                            <input type="radio" onChange={ () => handleClockRadioChange("chess") } checked={ isClockTypeSelected("chess") } />
                            Chess
                        </label>
                        <label className="radio-inline">
                            <input type="radio" onChange={ () => handleClockRadioChange("hourglass") } checked={ isClockTypeSelected("hourglass") } />
                            Hourglass
                        </label>
                        <label className="radio-inline">
                            <input type="radio" onChange={ () => handleClockRadioChange("byoyomi") } checked={ isClockTypeSelected("byoyomi") } />
                            Byoyomi
                        </label>
                    </div>
                </div>
                <div className="row">
                    <div className="col-sm-8">
                        <label>Main Time (Minutes)</label>
                        <input className="form-control" value={ clockTimer } onChange={ (event) => setClockTimer(event.target.value.replace(/\D/, "")) } />
                    </div>
                </div>
                { selectedClockType === "byoyomi" && (
                    <div className="row">
                        <div className="col-sm-8">
                            <label>Number of Byoyomi Periods</label>
                            <input className="form-control" value={ byoyomiPeriods } onChange={ (event) => setByoyomiPeriods(event.target.value.replace(/\D/, "")) } />
                            <label>Byoyomi Time Period (Seconds)</label>
                            <input className="form-control" value={ byoyomiTimePeriod } onChange={ (event) => setByoyomiTimePeriod(event.target.value.replace(/\D/, "")) } />
                        </div>
                    </div>
                ) }
            </div>
        );
    };

    const charsLeft = 140 - gameName.length;
    const selectedBotDeck = pretrainedBotDecks.find((deck) => deck.url === botDeckChoice);
    const botDeckLink = botDeckChoice === customBotDeck ? botDeckId.trim() : selectedBotDeck?.url || "";
    const isBotDeckLink = /^https?:\/\//i.test(botDeckLink);
    const benchmark = selectedBotDeck
        ? getBotBenchmark(benchmarkResults, botSeed, selectedBotDeck.benchmarkDeck)
        : null;

    if(!socket) {
        return (
            <div>
                Connecting to the server, please wait...
            </div>
        );
    }

    return (
        <div>
            <div className="panel-title text-center">
                New game
            </div>
            <div className="panel">
                <form className="form">
                    <div className="row">
                        <div className="col-sm-8">
                            <label htmlFor="gameName">Name</label>
                            <label className="game-name-char-limit">{ charsLeft >= 0 ? charsLeft : 0 }</label>
                            <input className="form-control" placeholder="Game Name" type="text" onChange={ handleNameChange } value={ gameName } />
                        </div>
                    </div>
                    <div className="row">
                        <div className="checkbox col-sm-8">
                            <label>
                                <input type="checkbox" onChange={ handleSpectatorsClick } checked={ spectators } />
                                Allow spectators
                            </label>
                        </div>
                        <div className="checkbox col-sm-8">
                            <label>
                                <input type="checkbox" onChange={ handleSpectatorSquelchClick } checked={ spectatorSquelch } />
                                Don't allow spectators to chat
                            </label>
                        </div>
                        <div className="checkbox col-sm-8">
                            <label>
                                <input type="checkbox" onChange={ handleClockClick } checked={ clocks } />
                                Timed game
                            </label>
                        </div>
                        <div className="checkbox col-sm-8">
                            <label>
                                <input
                                    type="checkbox"
                                    onChange={ handleBotOpponentClick }
                                    checked={ botOpponent }
                                    disabled={ selectedGameMode !== GameModes.Stronghold }
                                />
                                Human vs AI (only imperial)
                            </label>
                        </div>
                    </div>
                    { botOpponent && (
                        <div className="row game-password">
                            <div className="col-sm-8">
                                <label htmlFor="botDeckChoice">Bot deck</label>
                                <select
                                    id="botDeckChoice"
                                    className="form-control"
                                    onChange={ (event) => setBotDeckChoice(event.target.value) }
                                    value={ botDeckChoice }
                                >
                                    { pretrainedBotDecks.map((deck) => (
                                        <option key={ deck.url } value={ deck.url }>{ deck.label }</option>
                                    )) }
                                    <option value={ customBotDeck }>Custom deck id or EmeraldDB URL...</option>
                                </select>
                                { botDeckChoice === customBotDeck && (
                                    <input
                                        className="form-control"
                                        type="text"
                                        placeholder="Deck id or https://www.emeralddb.org/decks/..."
                                        onChange={ (event) => setBotDeckId(event.target.value) }
                                        value={ botDeckId }
                                    />
                                ) }
                                <label htmlFor="botType">Bot type</label>
                                <select
                                    id="botType"
                                    className="form-control"
                                    onChange={ (event) => setBotSeed(event.target.value) }
                                    value={ botSeed }
                                >
                                    { botSeedOptions.map((opt) => (
                                        <option key={ opt.value || "default" } value={ opt.value }>{ opt.label }</option>
                                    )) }
                                </select>
                                <small className="text-muted" aria-live="polite">
                                    { (botSeedOptions.find((opt) => opt.value === botSeed) || botSeedOptions[0]).desc }
                                </small>
                                <div aria-label="Standard bot benchmark">
                                    <small className="text-muted">
                                        { !selectedBotDeck ? (
                                            "Standard benchmark unavailable for custom decks."
                                        ) : benchmark.winRates || benchmark.roundRobin ? (
                                            <>
                                                { benchmark.seedLabel && (
                                                    <>
                                                        { `Standard self-play (${benchmark.seedLabel}).` }
                                                        <br />
                                                    </>
                                                ) }
                                                { benchmark.winRates
                                                    ? `Vs Crane Baseline: ${percentage(benchmark.winRates.winRate)} (${benchmark.winRates.wins}-${benchmark.winRates.losses}, N=${benchmark.winRateGames}).`
                                                    : "Vs Crane Baseline: not recorded." }
                                                <br />
                                                { benchmark.roundRobin
                                                    ? `Round robin: ${percentage(benchmark.roundRobin.averageOpponentWinRate)} average vs opponents, ${percentage(benchmark.roundRobin.overallWinRate)} overall (${benchmark.roundRobin.wins}-${benchmark.roundRobin.losses}, N=${benchmark.roundRobinGames}/matchup).`
                                                    : "Round robin: not recorded." }
                                            </>
                                        ) : (
                                            "No standardized 100-game benchmark recorded for this seed."
                                        ) }
                                    </small>
                                </div>
                                { isBotDeckLink && (
                                    <div>
                                        <a href={ botDeckLink } target="_blank" rel="noreferrer">{ botDeckLink }</a>
                                    </div>
                                ) }
                            </div>
                        </div>
                    ) }
                    <div className="row">
                        <div className="col-sm-12">
                            <b>Format</b>
                        </div>
                        <div className="col-sm-10">
                            <label className="radio-inline">
                                <input type="radio" onChange={ () => handleRulesRadioChange(GameModes.Emerald) } checked={ isGameModeSelected(GameModes.Emerald) } />
                                Emerald
                            </label>
                            <label className="radio-inline">
                                <input type="radio" onChange={ () => handleRulesRadioChange(GameModes.Sanctuary) } checked={ isGameModeSelected(GameModes.Sanctuary) } />
                                Sanctuary
                            </label>
                            <label className="radio-inline">
                                <input type="radio" onChange={ () => handleRulesRadioChange(GameModes.Stronghold) } checked={ isGameModeSelected(GameModes.Stronghold) } />
                                Imperial
                            </label>
                            <label className="radio-inline">
                                <input type="radio" onChange={ () => handleRulesRadioChange(GameModes.Skirmish) } checked={ isGameModeSelected(GameModes.Skirmish) } />
                                Skirmish
                            </label>
                            <label className="radio-inline">
                                <input type="radio" onChange={ () => handleRulesRadioChange(GameModes.Obsidian) } checked={ isGameModeSelected(GameModes.Obsidian) } />
                                Obsidian
                            </label>
                        </div>
                    </div>
                    <div className="row game-password">
                        <div className="col-sm-12">
                            <b>Game Type</b>
                        </div>
                        <div className="col-sm-10">
                            <label className="radio-inline">
                                <input type="radio" onChange={ () => handleRadioChange("beginner") } checked={ isGameTypeSelected("beginner") } />
                                Beginner
                            </label>
                            <label className="radio-inline">
                                <input type="radio" onChange={ () => handleRadioChange("casual") } checked={ isGameTypeSelected("casual") } />
                                Casual
                            </label>
                            <label className="radio-inline">
                                <input type="radio" onChange={ () => handleRadioChange("competitive") } checked={ isGameTypeSelected("competitive") } />
                                Competitive
                            </label>
                        </div>
                    </div>
                    { clocks ? getClockInput() : null }
                    <div className="row game-password">
                        <div className="col-sm-8">
                            <label>Password</label>
                            <input className="form-control" type="password" onChange={ handlePasswordChange } value={ password } />
                        </div>
                    </div>
                    <div className="button-row">
                        <button className="btn btn-primary" onClick={ handleSubmitClick }>Submit</button>
                        <button className="btn btn-primary" onClick={ handleCancelClick }>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

InnerNewGame.displayName = "NewGame";

function mapStateToProps(state) {
    return {
        allowMelee: state.auth.user ? state.auth.user.permissions.allowMelee : false,
        socket: state.socket.socket
    };
}

const NewGame = connect(mapStateToProps, actions)(InnerNewGame);

export default NewGame;
