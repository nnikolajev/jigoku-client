import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Upload, SkipBack, ChevronLeft, ChevronsLeft, Play, Pause, ChevronRight, ChevronsRight, SkipForward } from "lucide-react";
import { InnerGameBoard } from "./GameBoard.jsx";
import { parseGameLog } from "./GameComponents/gameLogSerializer.js";

const speeds = [
    { label: "0.5x", delay: 2000 },
    { label: "1x", delay: 1000 },
    { label: "2x", delay: 500 },
    { label: "4x", delay: 250 }
];

const noop = () => {};

function ReplayControls({ currentIndex, totalStates, isPlaying, speedIndex, currentRound, totalRounds, hasPrevRound, hasNextRound, onJumpToStart, onJumpToEnd, onStepBack, onStepForward, onPrevRound, onNextRound, onTogglePlay, onSpeedChange, onReset }) {
    return (
        <div className="replay-bar">
            <div className="replay-controls">
                <button className="btn btn-transparent" onClick={ onJumpToStart } disabled={ currentIndex === 0 } title="Jump to start">
                    <SkipBack size={ 14 } />
                </button>
                <button className="btn btn-transparent" onClick={ onPrevRound } disabled={ !hasPrevRound } title="Previous round">
                    <ChevronsLeft size={ 14 } />
                </button>
                <button className="btn btn-transparent" onClick={ onStepBack } disabled={ currentIndex === 0 } title="Step back">
                    <ChevronLeft size={ 14 } />
                </button>
                <button className="btn btn-transparent" onClick={ onTogglePlay } title={ isPlaying ? "Pause" : "Play" }>
                    { isPlaying ? <Pause size={ 14 } /> : <Play size={ 14 } /> }
                </button>
                <button className="btn btn-transparent" onClick={ onStepForward } disabled={ currentIndex >= totalStates - 1 } title="Step forward">
                    <ChevronRight size={ 14 } />
                </button>
                <button className="btn btn-transparent" onClick={ onNextRound } disabled={ !hasNextRound } title="Next round">
                    <ChevronsRight size={ 14 } />
                </button>
                <button className="btn btn-transparent" onClick={ onJumpToEnd } disabled={ currentIndex >= totalStates - 1 } title="Jump to end">
                    <SkipForward size={ 14 } />
                </button>
                <div className="replay-speed">
                    { speeds.map((s, i) => (
                        <button
                            key={ s.label }
                            className={ `btn btn-transparent${i === speedIndex ? " active" : ""}` }
                            onClick={ () => onSpeedChange(i) }
                        >
                            { s.label }
                        </button>
                    )) }
                </div>
                <span className="replay-progress">
                    { currentRound > 0 && (
                        <span className="replay-round">Round { currentRound }{ totalRounds > 0 ? ` / ${totalRounds}` : "" } · </span>
                    ) }
                    { currentIndex + 1 } / { totalStates }
                </span>
            </div>
            <div className="replay-actions">
                <button className="btn btn-default btn-sm" onClick={ onReset }>Load File</button>
            </div>
        </div>
    );
}

/**
 * Index of the first snapshot of each round, so the controls can skip a round
 * at a time.
 *
 * The replay state carries no round number — the only marker is the engine's
 * phase alert, `--- Round N - dynasty phase ---`, whose message fragments are
 * `["Round", " ", N, ...]`. Snapshots are keyed to accumulated messages, so a
 * round starts at the first snapshot whose log contains its alert.
 *
 * Returns `{ starts, roundByIndex }` where `starts[r]` is the snapshot index
 * that opens round `r + 1`.
 */
function findRoundStarts(replayData) {
    const starts = [];
    const roundByIndex = new Array(replayData.length).fill(0);
    let seen = 0;

    for(let i = 0; i < replayData.length; i++) {
        const messages = replayData[i].accumulatedMessages || [];
        let highest = seen;
        for(let m = messages.length - 1; m >= 0; m--) {
            const alert = messages[m]?.message?.alert;
            if(!alert || alert.type !== "endofround") {
                continue;
            }
            const fragments = Array.isArray(alert.message) ? alert.message : [alert.message];
            if(fragments[0] !== "Round") {
                continue;
            }
            const round = Number(fragments.find((fragment) => typeof fragment === "number"));
            if(Number.isFinite(round) && round > highest) {
                highest = round;
            }
            break;
        }
        // A new round opens here if this snapshot is the first to show it.
        while(seen < highest) {
            seen++;
            starts[seen - 1] = i;
        }
        roundByIndex[i] = seen;
    }

    return { starts, roundByIndex };
}

/**
 * Merge hidden info into a replay state snapshot.
 *
 * - Hand cards: revealed face-up (facedown: false)
 * - Province cards (type 'province'): card data added but kept facedown (visible on hover only)
 * - Dynasty cards on provinces: left untouched (never revealed)
 */
function mergeHiddenInfo(state, hiddenInfo) {
    if(!state.players || !hiddenInfo) {
        return state;
    }

    const merged = { ...state, players: { ...state.players } };

    for(const [playerName, info] of Object.entries(hiddenInfo)) {
        const player = merged.players[playerName];
        if(!player) {
            continue;
        }

        merged.players[playerName] = { ...player };

        // Replace facedown hand cards with revealed data (hand lives at cardPiles.hand)
        if(info.hand && player.cardPiles?.hand) {
            merged.players[playerName].cardPiles = { ...player.cardPiles };
            merged.players[playerName].cardPiles.hand = player.cardPiles.hand.map((card, i) => {
                if(card.facedown && info.hand[i]) {
                    return { ...card, ...info.hand[i], facedown: false };
                }
                return card;
            });
        }

        // For province cards (type 'province' only): add card data but keep facedown
        // so they appear as card backs on the board but show the real card on hover/zoom.
        // Dynasty cards (characters/holdings) on provinces are left untouched.
        if(info.provinces && player.provinces) {
            const provinceKeys = ["one", "two", "three", "four"];
            merged.players[playerName].provinces = { ...player.provinces };
            for(const key of provinceKeys) {
                const provinceCards = player.provinces[key];
                const hiddenCards = info.provinces[key];
                if(provinceCards && hiddenCards) {
                    merged.players[playerName].provinces[key] = provinceCards.map((card, i) => {
                        if(card.facedown && hiddenCards[i] && hiddenCards[i].type === "province") {
                            // Add id/name/packId so hover zoom shows the card, but keep facedown
                            return { ...card, id: hiddenCards[i].id, name: hiddenCards[i].name, packId: hiddenCards[i].packId };
                        }
                        return card;
                    });
                }
            }
        }

        const strongholdCards = player.strongholdProvince;
        const hiddenStronghold = info.provinces?.stronghold;
        const hiddenChildren = info.strongholdChildren;
        if(strongholdCards && (hiddenStronghold || hiddenChildren)) {
            merged.players[playerName].strongholdProvince = strongholdCards.map((card, i) => {
                let nextCard = card;
                const hidden = hiddenStronghold?.[i];
                if(card.facedown && hidden && (hidden.type === "stronghold" || hidden.type === "province")) {
                    nextCard = { ...nextCard, id: hidden.id, name: hidden.name, packId: hidden.packId };
                }
                if(card.isStronghold && Array.isArray(card.childCards) && hiddenChildren && hiddenChildren.length > 0) {
                    nextCard = {
                        ...nextCard,
                        childCards: card.childCards.map((child, j) => {
                            const revealed = hiddenChildren[j];
                            if(child.facedown && revealed) {
                                return { ...child, id: revealed.id, name: revealed.name, packId: revealed.packId };
                            }
                            return child;
                        })
                    };
                }
                return nextCard;
            });
        }
    }

    return merged;
}

// eslint-disable-next-line react/no-multi-comp
function GameReplay() {
    const [logData, setLogData] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speedIndex, setSpeedIndex] = useState(1);
    const [cardToZoom, setCardToZoom] = useState(null);
    const [error, setError] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [portalTarget, setPortalTarget] = useState(null);

    const fileInputRef = useRef(null);
    const intervalRef = useRef(null);

    const totalStates = logData?.replayData?.length || 0;

    const { starts: roundStarts, roundByIndex } = useMemo(
        () => (logData?.replayData?.length
            ? findRoundStarts(logData.replayData)
            : { starts: [], roundByIndex: [] }),
        [logData]
    );
    const currentRound = roundByIndex[currentIndex] || 0;

    useEffect(() => {
        if(logData) {
            const el = document.querySelector(".replay-mode .right-side .controls");
            if(el) {
                setPortalTarget(el);
            }
        }
    }, [logData, currentIndex]);

    useEffect(() => {
        if(isPlaying && totalStates > 0) {
            intervalRef.current = setInterval(() => {
                setCurrentIndex((prev) => {
                    if(prev >= totalStates - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, speeds[speedIndex].delay);
        }

        return () => {
            if(intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isPlaying, speedIndex, totalStates]);

    const handleFile = (file) => {
        setError(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const log = parseGameLog(e.target.result);
                if(!log.replayData || log.replayData.length === 0) {
                    setError("This log file does not contain replay data. Only logs downloaded after a game with replay recording will work.");
                    return;
                }
                setLogData(log);
                setCurrentIndex(0);
                setIsPlaying(false);
            } catch(err) {
                setError(`Failed to parse game log: ${err.message}`);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if(file) {
            handleFile(file);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleFileInput = (e) => {
        const file = e.target.files[0];
        if(file) {
            handleFile(file);
        }
    };

    const handleReset = () => {
        setLogData(null);
        setCurrentIndex(0);
        setIsPlaying(false);
        setError(null);
        setCardToZoom(null);
        setPortalTarget(null);
    };

    const handleJumpToStart = () => {
        setCurrentIndex(0);
        setIsPlaying(false);
    };

    const handleJumpToEnd = () => {
        setCurrentIndex(totalStates - 1);
        setIsPlaying(false);
    };

    // Rewind to the start of the round being viewed; if already there, to the
    // start of the one before it. Same behaviour as a track-skip button.
    const handlePrevRound = () => {
        const start = currentRound > 0 ? roundStarts[currentRound - 1] : 0;
        const target = currentIndex > start
            ? start
            : (currentRound > 1 ? roundStarts[currentRound - 2] : 0);
        setCurrentIndex(target ?? 0);
        setIsPlaying(false);
    };

    // `roundStarts[currentRound]` is the first snapshot of the NEXT round,
    // because the array is zero-indexed and rounds count from one.
    const handleNextRound = () => {
        const target = roundStarts[currentRound];
        if(target !== undefined) {
            setCurrentIndex(target);
            setIsPlaying(false);
        }
    };

    if(!logData) {
        return (
            <div className="replay-container">
                <div
                    className={ `replay-upload${dragOver ? " drag-over" : ""}` }
                    onDrop={ handleDrop }
                    onDragOver={ handleDragOver }
                    onDragLeave={ handleDragLeave }
                    onClick={ () => fileInputRef.current?.click() }
                >
                    <div className="replay-upload-icon">
                        <Upload size={ 48 } />
                    </div>
                    <div className="replay-upload-text">
                        Drop a game log file here, or click to browse
                    </div>
                    <div className="replay-upload-hint">
                        Accepts .json.gz or .json files
                    </div>
                    <input
                        ref={ fileInputRef }
                        type="file"
                        accept=".json,.gz,.json.gz"
                        style={ { display: "none" } }
                        onChange={ handleFileInput }
                    />
                </div>
                { error && <div className="replay-error">{ error }</div> }
            </div>
        );
    }

    const entry = logData.replayData[currentIndex];
    const baseState = {
        ...entry.state,
        messages: entry.accumulatedMessages || []
    };

    // Merge hidden info (opponent's hand cards + facedown provinces) into displayed state
    const currentState = entry.hiddenInfo ? mergeHiddenInfo(baseState, entry.hiddenInfo) : baseState;

    const metadata = logData.metadata;
    const playerNames = metadata.players.map((p) => p.name);
    // Use the downloading player as the perspective (bottom of board), fall back to first player
    const username = metadata.downloadedBy || playerNames[0] || "__replay_spectator__";

    const replayUser = {
        settings: {
            cardSize: "normal",
            optionSettings: {}
        }
    };

    const metaText = metadata.players.map((p) => `${p.name} (${p.faction})`).join(" vs ")
        + (metadata.winner ? ` — Winner: ${metadata.winner}` : "");

    return (
        <div className="replay-mode">
            <div className="replay-navbar-info">
                { metadata.gameName } — { metaText }
            </div>
            <InnerGameBoard
                currentGame={ currentState }
                username={ username }
                user={ replayUser }
                cards={ {} }
                cardToZoom={ cardToZoom }
                zoomCard={ setCardToZoom }
                clearZoom={ () => setCardToZoom(null) }
                dispatch={ noop }
                sendGameMessage={ noop }
                closeGameSocket={ noop }
                setContextMenu={ noop }
                socket={ {} }
                replayMode
            />
            { portalTarget && createPortal(
                <ReplayControls
                    currentIndex={ currentIndex }
                    totalStates={ totalStates }
                    isPlaying={ isPlaying }
                    speedIndex={ speedIndex }
                    currentRound={ currentRound }
                    totalRounds={ roundStarts.length }
                    hasPrevRound={ currentIndex > 0 }
                    hasNextRound={ roundStarts[currentRound] !== undefined }
                    onJumpToStart={ handleJumpToStart }
                    onJumpToEnd={ handleJumpToEnd }
                    onPrevRound={ handlePrevRound }
                    onNextRound={ handleNextRound }
                    onStepBack={ () => setCurrentIndex((i) => Math.max(0, i - 1)) }
                    onStepForward={ () => setCurrentIndex((i) => Math.min(totalStates - 1, i + 1)) }
                    onTogglePlay={ () => setIsPlaying(!isPlaying) }
                    onSpeedChange={ setSpeedIndex }
                    onReset={ handleReset }
                />,
                portalTarget
            ) }
        </div>
    );
}

GameReplay.displayName = "GameReplay";

export default GameReplay;
