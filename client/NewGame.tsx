import { useState } from "react";
import { connect } from "react-redux";
import GameModes from "./GameModes";

import * as actions from "./actions";

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
        label: "Copy of [Precon15] Unicorn Cavalry (v0.5)",
        url: "https://www.emeralddb.org/decks/9a72e4b7-556a-457d-a891-2ed2d92ac5d5"
    },
    {
        label: "[Precon15] Crab Defense (Flooded Waste)",
        url: "https://www.emeralddb.org/decks/c9381e02-8fb2-46b8-b900-f102376c8cf0"
    },
    {
        label: "[Precon15] Unicorn Military Rush (Temple)",
        url: "https://www.emeralddb.org/decks/52b78858-fce5-431a-a3e5-be4f2a921ed9"
    },
    {
        label: "Scorpion Poison Mill (dishonor)",
        url: "https://www.emeralddb.org/decks/5eb874cc-45a6-45d6-8c74-3729750d0b51"
    },
    {
        label: "[Precon15] Lion Bushi (swarm, Rich Frog)",
        url: "https://www.emeralddb.org/decks/c99f60e2-2f85-4c0f-aaa6-d7c16112cbbf"
    },
    {
        label: "Phoenix For Honor and Glory",
        url: "https://www.emeralddb.org/decks/7c5b9776-046d-4bc3-bd62-209b1cf4efa9"
    },
    {
        label: "Dragon Monks (Togashi Mitsu)",
        url: "https://www.emeralddb.org/decks/4fb91e58-9c3b-47e1-983e-133e0a4d9254"
    },
    {
        label: "Crane Duels (upgraded, Tsuma)",
        url: "https://www.emeralddb.org/decks/e2e443b5-77b1-41b4-8435-ededfb187311"
    },
    {
        label: "Phoenix Shugenja",
        url: "https://www.emeralddb.org/decks/b260d778-0016-4d70-b1f9-5180daf340fc"
    },
    {
        label: "Dragon Attachments",
        url: "https://www.emeralddb.org/decks/46aaa220-2cf9-463b-bdf3-3019572432ff"
    }
];
const customBotDeck = "custom";

// Bot difficulty seeds. The `value` is passed straight to the server as the bot
// `seed` (blank = default heuristic). Keep in sync with jigoku
// JigokuBotController seed handling.
const botSeedOptions = [
    {
        value: "",
        label: "Heuristic (default)",
        desc: "Hand-written strategy bot. Fast, plays a solid fair game with no hidden information."
    },
    {
        value: "4",
        label: "Omniscient (cheating — hardest)",
        desc: "Same heuristics as default but sees your hand and face-down provinces. Attacks your weakest province, presses when you cannot fight back, and holds when it cannot win. Requires the bot deck to be analyzed first."
    },
    {
        value: "2",
        label: "LLM-driven (experimental)",
        desc: "A local LLM (LM Studio) picks every action. Slow and only as good as the model; experimental."
    },
    {
        value: "3",
        label: "Self-play ML (experimental)",
        desc: "Learned evaluator trained by self-play. Not competitive — kept for research; do not expect a strong game."
    }
];

export function InnerNewGame({ cancelNewGame, defaultGameName, loadDecks, socket }) {
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
    const [botSeed, setBotSeed] = useState("");

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
        if(event.target.checked) {
            setSelectedGameMode(GameModes.Stronghold);
        }
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
                                <input type="checkbox" onChange={ handleBotOpponentClick } checked={ botOpponent } />
                                Human vs AI
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
                                <label htmlFor="botDifficulty">Bot difficulty</label>
                                <select
                                    id="botDifficulty"
                                    className="form-control"
                                    onChange={ (event) => setBotSeed(event.target.value) }
                                    value={ botSeed }
                                >
                                    { botSeedOptions.map((opt) => (
                                        <option key={ opt.value || "default" } value={ opt.value }>{ opt.label }</option>
                                    )) }
                                </select>
                                <small className="text-muted">
                                    { (botSeedOptions.find((opt) => opt.value === botSeed) || botSeedOptions[0]).desc }
                                </small>
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
