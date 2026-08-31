import React, { createRef } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "@reduxjs/toolkit";
import Draggable from "react-draggable";

import PlayerStatsBox from "./GameComponents/PlayerStatsBox.jsx";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in commented-out sidebar stats feature
import PlayerStatsRow from "./GameComponents/PlayerStatsRow.jsx";
import PlayerHand from "./GameComponents/PlayerHand.jsx";
import DynastyRow from "./GameComponents/DynastyRow.jsx";
import StrongholdRow from "./GameComponents/StrongholdRow.jsx";
import Ring from "./GameComponents/Ring.jsx";
import HonorFan from "./GameComponents/HonorFan.jsx";
import ActivePlayerPrompt from "./GameComponents/ActivePlayerPrompt.jsx";
import Avatar from "./Avatar.jsx";
import CardZoom from "./GameComponents/CardZoom.jsx";
import Card from "./GameComponents/Card.jsx";
import Chat from "./GameComponents/Chat.jsx";
import Controls from "./GameComponents/Controls.jsx";
import CardPile from "./GameComponents/CardPile.jsx";
import GameConfiguration from "./GameComponents/GameConfiguration.jsx";
import StatDelta from "./GameComponents/effects/StatDelta.jsx";
import ConflictSlamEffect from "./GameComponents/effects/ConflictSlamEffect.jsx";
import { countCardPlayMessages, detectConflictProvinceBreak } from "./GameComponents/effects/gameEvents.js";
import CardPlaySpotlight, { SPOTLIGHT_DURATION_MS, SPOTLIGHT_MAX_VISIBLE, loadSpotlightEnabled, saveSpotlightEnabled } from "./GameComponents/effects/CardPlaySpotlight.jsx";
import { detectNewSpotlightEvents, detectNewTargetContinuations, mergeTargets } from "./GameComponents/effects/cardPlaySpotlight.js";
import ConflictArrows from "./GameComponents/effects/ConflictArrows.jsx";
import BlockedCards from "./GameComponents/effects/BlockedCards.jsx";
import NamedCardMarkers from "./GameComponents/effects/NamedCardMarkers.jsx";
import { resolveNamedCards } from "./GameComponents/effects/namedCards.js";
import GameHistory from "./GameComponents/effects/GameHistory.jsx";
import { recordConflictState } from "./GameComponents/effects/conflictLedger.js";
import { advanceDeclarationTally } from "./GameComponents/effects/messageFragments.js";
import { playCardPlay, playMilitaryWin, playPoliticalWin } from "./GameComponents/effects/gameSounds.js";
import { tryParseJSON } from "./util.js";
import { downloadGameLog } from "./GameComponents/gameLogSerializer.js";
import { captureGameStateSnapshot } from "./GameComponents/gameStateSnapshot.js";
import GameModes from "./GameModes";
import { getCardImageUrl } from "./cardImageUrl.js";

import * as actions from "./actions";

const WIN_EFFECTS_STORAGE_KEY = "jigoku.conflictWinEffectsEnabled";

function loadWinEffectsPreference() {
    try {
        return typeof window === "undefined" || window.localStorage.getItem(WIN_EFFECTS_STORAGE_KEY) !== "false";
    } catch{
        return true;
    }
}

function saveWinEffectsPreference(enabled) {
    try {
        window.localStorage.setItem(WIN_EFFECTS_STORAGE_KEY, String(enabled));
    } catch{
        // Storage can be unavailable in private browsing; current-session state still works.
    }
}

export class InnerGameBoard extends React.Component {
    constructor(props) {
        super(props);

        this.modalRef = createRef();
        this.draggableRef = createRef();
        this.opponentDraggableRef = createRef();

        this.onMouseOut = this.onMouseOut.bind(this);
        this.onMouseOver = this.onMouseOver.bind(this);
        this.onRingClick = this.onRingClick.bind(this);
        this.onCardClick = this.onCardClick.bind(this);
        this.onConflictClick = this.onConflictClick.bind(this);
        this.onDynastyClick = this.onDynastyClick.bind(this);
        this.onDragDrop = this.onDragDrop.bind(this);
        this.onCommand = this.onCommand.bind(this);
        this.onConcedeClick = this.onConcedeClick.bind(this);
        this.onLeaveClick = this.onLeaveClick.bind(this);
        this.onConflictShuffleClick = this.onConflictShuffleClick.bind(this);
        this.onDynastyShuffleClick = this.onDynastyShuffleClick.bind(this);
        this.onMenuItemClick = this.onMenuItemClick.bind(this);
        this.onRingMenuItemClick = this.onRingMenuItemClick.bind(this);
        this.onManualModeClick = this.onManualModeClick.bind(this);
        this.onSettingsClick = this.onSettingsClick.bind(this);
        this.onToggleChatClick = this.onToggleChatClick.bind(this);
        this.onDownloadLogClick = this.onDownloadLogClick.bind(this);
        this.onShowBotHandClick = this.onShowBotHandClick.bind(this);
        this.onCaptureStateClick = this.onCaptureStateClick.bind(this);
        this.onTimerExpired = this.onTimerExpired.bind(this);
        this.sendMessage = this.sendMessage.bind(this);
        this.clearSlamEffect = this.clearSlamEffect.bind(this);
        this.onTestAnimationClick = this.onTestAnimationClick.bind(this);
        this.onToggleWinEffectsClick = this.onToggleWinEffectsClick.bind(this);
        this.onSpotlightToggle = this.onSpotlightToggle.bind(this);
        this.onHistoryClick = this.onHistoryClick.bind(this);
        this.onHistoryClose = this.onHistoryClose.bind(this);

        this.boundActions = bindActionCreators(actions, props.dispatch);

        this._cardsInPlayCache = {};
        this._slamEffectSequence = 0;
        this._spotlightSequence = 0;
        this._spotlightTimers = [];
        this._declarationTally = { count: 0, scanned: 0 };

        this.state = {
            cardToZoom: undefined,
            showChat: true,
            showChatAlert: false,
            showConflictDeck: false,
            showDynastyDeck: false,
            spectating: true,
            showActionWindowsMenu: false,
            showCardMenu: {},
            showSettingsModal: false,
            slamEffect: null,
            animationTestVariant: "military",
            winEffectsEnabled: loadWinEffectsPreference(),
            spotlightEnabled: loadSpotlightEnabled(),
            spotlightEvents: [],
            showHistory: false,
            conflictLedger: []
        };
    }

    componentDidMount() {
        this.updateContextMenu(this.props);
    }

    componentDidUpdate(prevProps) {
        if(prevProps.currentGame !== this.props.currentGame || prevProps.username !== this.props.username) {
            this.updateContextMenu(this.props);
        }
        this.notifyOfNewMessages(this.props, prevProps);
        this.playGameEffects(prevProps);
    }

    componentWillUnmount() {
        this._spotlightTimers.forEach(timer => clearTimeout(timer));
        this._spotlightTimers = [];
    }

    playGameEffects(prevProps) {
        const prevGame = prevProps.currentGame;
        const currentGame = this.props.currentGame;
        if(!prevGame || !currentGame || prevGame === currentGame || prevGame.name !== currentGame.name) {
            return;
        }

        const prevPlays = countCardPlayMessages(prevGame.messages || []);
        const currentPlays = countCardPlayMessages(currentGame.messages || []);
        if(currentPlays > prevPlays) {
            playCardPlay();
        }

        // The tally advances by reading only the messages that arrived, and recounts
        // from scratch when the log shrank -- which is a replay seeking backwards.
        this._declarationTally = advanceDeclarationTally(this._declarationTally, currentGame.messages);
        const declarationCount = this._declarationTally.count;
        this.setState(state => {
            const conflictLedger = recordConflictState(state.conflictLedger, currentGame, declarationCount);
            return conflictLedger === state.conflictLedger ? null : { conflictLedger };
        });

        this.collectSpotlightEvents(prevGame, currentGame);

        if(!this.state.winEffectsEnabled) {
            return;
        }

        const provinceBreak = detectConflictProvinceBreak(prevGame, currentGame);
        if(provinceBreak && provinceBreak.skillDifference >= 5) {
            this.playSlamEffect(provinceBreak.type === "political" ? "political" : "military");
        }
    }

    // Card-play spotlight. Disabled short-circuits before any parsing, so the feature
    // costs nothing while off.
    collectSpotlightEvents(prevGame, currentGame) {
        if(!this.state.spotlightEnabled) {
            return;
        }

        this._spotlightSequence += 1;
        const events = detectNewSpotlightEvents(prevGame.messages || [], currentGame.messages || [], this._spotlightSequence);
        // FALLBACK for a server that sends no records: a "{0} chooses to honor {1}"
        // follow-up names the chosen cards but not the ability that chose them, so they
        // can only be attached to whatever is already on screen. A recorded follow-up
        // names its own source and arrives above as an ordinary event instead.
        const orphanTargets = detectNewTargetContinuations(prevGame.messages || [], currentGame.messages || []);
        if(events.length === 0 && orphanTargets.length === 0) {
            return;
        }

        this.setState(state => {
            let next = state.spotlightEvents;

            for(const event of events) {
                // One entry per source card: a card played and then given its target in a
                // follow-up entry is ONE thing happening, so the arrow joins the entry
                // already showing that card rather than stacking a second copy of it.
                const existing = next.findIndex(shown => shown.source.uuid === event.source.uuid);
                if(existing >= 0) {
                    const merged = {
                        ...next[existing],
                        targets: mergeTargets(next[existing].targets, event.targets)
                    };
                    next = [...next.slice(0, existing), ...next.slice(existing + 1), merged];
                } else {
                    next = [...next, event];
                }
            }

            // Only ever attached to an entry still on screen. Attaching to the last card
            // played regardless showed an unrelated card again on every prompt.
            if(orphanTargets.length > 0 && next.length > 0) {
                const last = next[next.length - 1];
                next = [...next.slice(0, -1), { ...last, targets: mergeTargets(last.targets, orphanTargets) }];
            }

            return { spotlightEvents: next.slice(-SPOTLIGHT_MAX_VISIBLE) };
        });

        if(events.length === 0) {
            return;
        }

        // Each arriving event keeps its own lifetime; a merge refreshes nothing, so an
        // entry cannot be held on screen indefinitely by a stream of follow-ups.
        const keys = new Set(events.map(event => event.key));
        const sources = new Set(events.map(event => event.source.uuid));
        const timer = setTimeout(() => {
            this._spotlightTimers = this._spotlightTimers.filter(entry => entry !== timer);
            this.setState(state => ({
                spotlightEvents: state.spotlightEvents.filter(
                    event => !keys.has(event.key) && !sources.has(event.source.uuid)
                )
            }));
        }, SPOTLIGHT_DURATION_MS);
        this._spotlightTimers.push(timer);
    }

    onSpotlightToggle(enabled) {
        saveSpotlightEnabled(enabled);
        this.setState({ spotlightEnabled: enabled, spotlightEvents: [] });
    }

    onHistoryClick(event) {
        event.preventDefault();
        this.setState({ showHistory: true });
    }

    onHistoryClose() {
        this.setState({ showHistory: false });
    }

    playSlamEffect(variant, additionalState = {}) {
        if(variant === "military") {
            playMilitaryWin();
        } else {
            playPoliticalWin();
        }
        this._slamEffectSequence += 1;
        this.setState({ ...additionalState, slamEffect: { variant, key: this._slamEffectSequence } });
    }

    onTestAnimationClick() {
        const variant = this.state.animationTestVariant;
        this.playSlamEffect(variant, {
            animationTestVariant: variant === "military" ? "political" : "military"
        });
    }

    onToggleWinEffectsClick() {
        const winEffectsEnabled = !this.state.winEffectsEnabled;
        saveWinEffectsPreference(winEffectsEnabled);
        this.setState({
            winEffectsEnabled,
            slamEffect: winEffectsEnabled ? this.state.slamEffect : null
        });
    }

    clearSlamEffect() {
        this.setState({ slamEffect: null });
    }

    notifyOfNewMessages(currentProps, prevProps) {
        if(currentProps.currentGame && !this.state.showChat) {
            const prevLength = this.getMessagesFromPlayers(prevProps.currentGame?.messages || []).length;
            const currentLength = this.getMessagesFromPlayers(currentProps.currentGame.messages || []).length;

            if(prevLength < currentLength) {
                this.setState({ showChatAlert: true });
            }
        }
    }

    getMessagesFromPlayers(messages) {
        return messages.filter(
            (message) => (message.message instanceof Array) && message.message.some((fragment) => !!fragment.name)
        );
    }

    updateContextMenu(props) {
        if(!props.currentGame) {
            return;
        }

        let thisPlayer = props.currentGame.players[props.username];

        if(thisPlayer) {
            this.setState({ spectating: false });
        } else {
            this.setState({ spectating: true });
        }

        if(thisPlayer && thisPlayer.selectCard) {
            document.body.classList.add("select-cursor");
        } else {
            document.body.classList.remove("select-cursor");
        }

        let menuOptions = [
            { text: "Leave Game", onClick: this.onLeaveClick }
        ];

        if(props.currentGame && props.currentGame.started) {
            if(Object.values(props.currentGame.players).find(p => {
                return p.name === props.username;
            })) {
                menuOptions.unshift({ text: "Concede", onClick: this.onConcedeClick });
            }

            let spectators = props.currentGame.spectators.map(spectator => {
                return <li key={ spectator.id }>{ spectator.name }</li>;
            });

            let spectatorPopup = (
                <ul className="spectators-popup absolute-panel">
                    { spectators }
                </ul>
            );

            menuOptions.unshift({ text: `Spectators: ${props.currentGame.spectators.length}`, popup: spectatorPopup });

            this.setContextMenu(menuOptions);
        } else {
            this.setContextMenu([]);
        }
    }

    setContextMenu(menu) {
        if(this.props.setContextMenu) {
            this.props.setContextMenu(menu);
        }
    }

    onConcedeClick() {
        this.props.sendGameMessage("concede");
    }

    isGameActive() {
        if(!this.props.currentGame) {
            return false;
        }

        if(this.props.currentGame.winner) {
            return false;
        }

        let thisPlayer = this.props.currentGame.players[this.props.username];
        if(!thisPlayer) {
            thisPlayer = Object.values(this.props.currentGame.players).sort((a, b) => a.name.localeCompare(b.name))[0];
        }

        let otherPlayer = Object.values(this.props.currentGame.players).find(player => {
            return player.name !== thisPlayer.name;
        });

        if(!otherPlayer) {
            return false;
        }

        if(otherPlayer.disconnected || otherPlayer.left) {
            return false;
        }

        return true;
    }

    onLeaveClick() {
        if(!this.state.spectating && this.isGameActive()) {
            if(window.confirm("Your game is not finished, are you sure you want to leave?")) {
                this.props.sendGameMessage("leavegame");
                this.props.closeGameSocket();
            }

            return;
        }

        this.props.sendGameMessage("leavegame");
        this.props.closeGameSocket();
    }

    onMouseOver(card) {
        this.props.zoomCard(card);
    }

    onMouseOut() {
        this.props.clearZoom();
    }

    getCardImageUrl(card) {
        if(!card || !card.id) {
            return "";
        }
        return getCardImageUrl(card.id, card.packId);
    }

    onCardClick(card) {
        if(card && card.uuid) {
            this.props.sendGameMessage("cardClicked", card.uuid);
        } else if(card && card.location && card.controller) {
            this.props.sendGameMessage("facedownCardClicked", card.location, card.controller.name, card.isProvince);
        }
    }

    onRingClick(ring) {
        this.props.sendGameMessage("ringClicked", ring);
    }

    onConflictClick() {
        this.props.sendGameMessage("showConflictDeck");

        this.setState({ showConflictDeck: !this.state.showConflictDeck });
    }

    onDynastyClick() {
        this.props.sendGameMessage("showDynastyDeck");

        this.setState({ showDynastyDeck: !this.state.showDynastyDeck });
    }

    sendMessage(message) {
        if(message === "") {
            return;
        }

        this.props.sendGameMessage("chat", message);
    }

    onConflictShuffleClick() {
        this.props.sendGameMessage("shuffleConflictDeck");
    }

    onDynastyShuffleClick() {
        this.props.sendGameMessage("shuffleDynastyDeck");
    }

    onDragDrop(card, source, target) {
        this.props.sendGameMessage("drop", card.uuid, source, target);
    }

    onCardDragStart(event, card, source) {
        let dragData = { card: card, source: source };
        event.dataTransfer.setData("Text", JSON.stringify(dragData));
    }

    getCardsInPlay(player, isMe) {
        if(!player) {
            return [];
        }

        let cacheKey = isMe ? "me" : "other";
        let cached = this._cardsInPlayCache[cacheKey];
        let conflict = this.props.currentGame.conflict;
        let cardSize = this.props.user.settings.cardSize;
        let disableCardStats = this.props.user.settings.optionSettings.disableCardStats;

        if(cached &&
            cached.cardsInPlay === player.cardPiles.cardsInPlay &&
            cached.conflict === conflict &&
            cached.cardSize === cardSize &&
            cached.disableCardStats === disableCardStats) {
            return cached.result;
        }

        let sortedCards = [...player.cardPiles.cardsInPlay].sort((a, b) => {
            if(a.type < b.type) {
                return -1;
            }
            if(a.type > b.type) {
                return 1;
            }
            return 0;
        });

        if(!isMe) {
            // we want locations on the bottom, other side wants locations on top
            sortedCards = sortedCards.reverse();
        }

        // Group by type
        const cardsByType = {};
        sortedCards.forEach(card => {
            const type = card.type;
            if(!cardsByType[type]) {
                cardsByType[type] = [];
            }
            cardsByType[type].push(card);
        });

        let cardsByLocation = [];
        let playerIsDefending = (player && conflict.defendingPlayerId && player.id.includes(conflict.defendingPlayerId));
        let playerDeclaringParticipants = conflict && (!conflict.declarationComplete || (playerIsDefending && !conflict.defendersChosen));

        Object.values(cardsByType).forEach(cards => {
            let cardsInPlay = cards.map(card => {
                return (<Card key={ card.uuid } id={ card.uuid } source="play area" card={ card } disableMouseOver={ card.facedown && !card.code }
                    onMenuItemClick={ this.onMenuItemClick } onMouseOver={ this.onMouseOver } onMouseOut={ this.onMouseOut }
                    showStats={ !disableCardStats } player={ player }
                    onClick={ this.onCardClick } onDragDrop={ this.onDragDrop } size={ cardSize } isMe={ isMe } declaring={ playerDeclaringParticipants }/>);
            });
            cardsByLocation.push(cardsInPlay);
        });

        this._cardsInPlayCache[cacheKey] = {
            cardsInPlay: player.cardPiles.cardsInPlay,
            conflict,
            cardSize,
            disableCardStats,
            result: cardsByLocation
        };

        return cardsByLocation;
    }

    onCommand(command, arg, uuid, method) {
        let commandArg = arg;

        this.props.sendGameMessage(command, commandArg, uuid, method);
    }

    onDragOver(event) {
        event.preventDefault();
    }

    onDragDropEvent(event, target) {
        event.stopPropagation();
        event.preventDefault();

        let card = event.dataTransfer.getData("Text");
        if(!card) {
            return;
        }

        let dragData = tryParseJSON(card);

        if(!dragData) {
            return;
        }

        this.onDragDrop(dragData.card, dragData.source, target);
    }

    onMenuItemClick(card, menuItem) {
        this.props.sendGameMessage("menuItemClick", card.uuid, menuItem);
    }

    onRingMenuItemClick(ring, menuItem) {
        this.props.sendGameMessage("ringMenuItemClick", ring, menuItem);
    }

    onPromptedActionWindowToggle(option, value) {
        this.props.sendGameMessage("togglePromptedActionWindow", option, value);
    }

    onTimerSettingToggle(option, value) {
        this.props.sendGameMessage("toggleTimerSetting", option, value);
    }

    onOptionSettingToggle(option, value) {
        this.props.sendGameMessage("toggleOptionSetting", option, value);
    }

    onTimerExpired() {
        this.props.sendGameMessage("menuButton", null, "pass");
    }

    onSettingsClick(event) {
        event.preventDefault();
        this.setState({ showSettingsModal: true });
    }

    onToggleChatClick(event) {
        event.preventDefault();
        this.setState({
            showChat: !this.state.showChat,
            showChatAlert: this.state.showChat && this.state.showChatAlert
        });
    }

    onManualModeClick(event) {
        event.preventDefault();
        this.props.sendGameMessage("toggleManualMode");
    }

    onDownloadLogClick() {
        if(this.props.currentGame) {
            downloadGameLog(this.props.currentGame, this.props.username);
        }
    }

    onShowBotHandClick(event) {
        event.preventDefault();
        this.props.sendGameMessage("toggleShowBotHand");
    }

    onCaptureStateClick() {
        if(this.props.currentGame) {
            captureGameStateSnapshot(this.props.currentGame, this.props.username);
        }
    }

    getRings(owner, className) {
        const thisPlayer = this.props.currentGame.players[this.props.username];
        const showRingEffects = thisPlayer?.optionSettings?.showRingEffects;
        const gameMode = this.props.currentGame.gameMode;
        return (<div className={ className } >
            { !this.props.currentGame.rings.air.removedFromGame ? <Ring owner={ owner } ring={ this.props.currentGame.rings.air } onClick={ this.onRingClick } size={ this.props.user.settings.cardSize } onMenuItemClick={ this.onRingMenuItemClick } showRingEffects={ showRingEffects } gameMode={ gameMode } /> : null }
            { !this.props.currentGame.rings.earth.removedFromGame ? <Ring owner={ owner } ring={ this.props.currentGame.rings.earth } onClick={ this.onRingClick } size={ this.props.user.settings.cardSize } onMenuItemClick={ this.onRingMenuItemClick } showRingEffects={ showRingEffects } gameMode={ gameMode } /> : null }
            { !this.props.currentGame.rings.fire.removedFromGame ? <Ring owner={ owner } ring={ this.props.currentGame.rings.fire } onClick={ this.onRingClick } size={ this.props.user.settings.cardSize } onMenuItemClick={ this.onRingMenuItemClick } showRingEffects={ showRingEffects } gameMode={ gameMode } /> : null }
            { !this.props.currentGame.rings.void.removedFromGame ? <Ring owner={ owner } ring={ this.props.currentGame.rings.void } onClick={ this.onRingClick } size={ this.props.user.settings.cardSize } onMenuItemClick={ this.onRingMenuItemClick } showRingEffects={ showRingEffects } gameMode={ gameMode } /> : null }
            { !this.props.currentGame.rings.water.removedFromGame ? <Ring owner={ owner } ring={ this.props.currentGame.rings.water } onClick={ this.onRingClick } size={ this.props.user.settings.cardSize } onMenuItemClick={ this.onRingMenuItemClick } showRingEffects={ showRingEffects } gameMode={ gameMode } /> : null }
        </div>);
    }

    getRemovedRings(owner, className) {
        const thisPlayer = this.props.currentGame.players[this.props.username];
        const showRingEffects = thisPlayer?.optionSettings?.showRingEffects;
        const gameMode = this.props.currentGame.gameMode;
        return (
            <div className={ className }>
                { this.props.currentGame.rings.air.removedFromGame ? <Ring owner={ owner } ring={ this.props.currentGame.rings.air } onClick={ this.onRingClick } size={ this.props.user.settings.cardSize } onMenuItemClick={ this.onRingMenuItemClick } showRingEffects={ showRingEffects } gameMode={ gameMode } /> : null }
                { this.props.currentGame.rings.earth.removedFromGame ? <Ring owner={ owner } ring={ this.props.currentGame.rings.earth } onClick={ this.onRingClick } size={ this.props.user.settings.cardSize } onMenuItemClick={ this.onRingMenuItemClick } showRingEffects={ showRingEffects } gameMode={ gameMode } /> : null }
                { this.props.currentGame.rings.fire.removedFromGame ? <Ring owner={ owner } ring={ this.props.currentGame.rings.fire } onClick={ this.onRingClick } size={ this.props.user.settings.cardSize } onMenuItemClick={ this.onRingMenuItemClick } showRingEffects={ showRingEffects } gameMode={ gameMode } /> : null }
                { this.props.currentGame.rings.void.removedFromGame ? <Ring owner={ owner } ring={ this.props.currentGame.rings.void } onClick={ this.onRingClick } size={ this.props.user.settings.cardSize } onMenuItemClick={ this.onRingMenuItemClick } showRingEffects={ showRingEffects } gameMode={ gameMode } /> : null }
                { this.props.currentGame.rings.water.removedFromGame ? <Ring owner={ owner } ring={ this.props.currentGame.rings.water } onClick={ this.onRingClick } size={ this.props.user.settings.cardSize } onMenuItemClick={ this.onRingMenuItemClick } showRingEffects={ showRingEffects } gameMode={ gameMode } /> : null }
            </div>
        );
    }

    renderCenterBar(thisPlayer, otherPlayer, conflict) {
        var conflictElement;
        //if there's an active conflict, build the conflict tracker element
        if(conflict.attackingPlayerId) {
            let thisPlayerSkill = "-";
            let otherPlayerSkill = "-";
            if(otherPlayer && otherPlayer.id.includes(conflict.attackingPlayerId)) {
                otherPlayerSkill = (conflict.attackerSkill !== undefined) ? conflict.attackerSkill : "-";
                thisPlayerSkill = (conflict.defenderSkill !== undefined && !conflict.unopposed) ? conflict.defenderSkill : "-";
            } else if(otherPlayer && otherPlayer.id.includes(conflict.defendingPlayerId)) {
                otherPlayerSkill = (conflict.defenderSkill !== undefined && !conflict.unopposed) ? conflict.defenderSkill : "-";
                thisPlayerSkill = (conflict.attackerSkill !== undefined) ? conflict.attackerSkill : "-";
            } else {
                //games with no opponent should still show conflict skill
                thisPlayerSkill = (conflict.attackerSkill !== undefined) ? conflict.attackerSkill : "-";
            }
            let conflictClass = `icon-${conflict.type} conflict-${conflict.type} icon-medium skill-symbol`;

            conflictElement = (<div>
                <div className="conflict-panel">
                    <div className="phase-display conflict-count-top stat-delta-host">
                        { otherPlayerSkill }
                        <StatDelta value={ otherPlayerSkill } />
                    </div>
                    <div className="phase-display conflict-separator">
                        vs
                    </div>
                    <div className="phase-display conflict-count-bottom stat-delta-host">
                        { thisPlayerSkill }
                        <StatDelta value={ thisPlayerSkill } />
                    </div>
                </div>
                <div className="conflict-panel">
                    <div className="phase-display">
                        <span className={ conflictClass } >&nbsp;</span>
                        { conflict.elements && conflict.elements.includes("fire") && <span className="icon-element-fire">&nbsp;</span> }
                        { conflict.elements && conflict.elements.includes("water") && <span className="icon-element-water">&nbsp;</span> }
                        { conflict.elements && conflict.elements.includes("earth") && <span className="icon-element-earth">&nbsp;</span> }
                        { conflict.elements && conflict.elements.includes("air") && <span className="icon-element-air">&nbsp;</span> }
                        { conflict.elements && conflict.elements.includes("void") && <span className="icon-element-void" /> }
                    </div>
                </div>

            </div>);
        } else {
            conflictElement = <div />;
        }

        return (<div className="center-bar">
            { this.getRings(null, "ring-panel") }
            { this.anyRemovedRings() ? this.getRemovedRings(null, "ring-panel removed-rings") : null }
            { conflictElement }
            { this.getCardsPlayedTracker(conflict, thisPlayer, otherPlayer) }
            { this.getRingAttachments(thisPlayer, otherPlayer) }
        </div>);
    }

    anyRemovedRings() {
        const rings = this.props.currentGame.rings;

        return rings.air.removedFromGame || rings.earth.removedFromGame || rings.water.removedFromGame || rings.fire.removedFromGame || rings.void.removedFromGame;
    }

    getCardsPlayedTracker(conflict, thisPlayer, otherPlayer) {
        const handImageStyle = { backgroundImage: "url(/img/conflictcard.png)" };

        if(!conflict.attackingPlayerId) {
            return null;
        }

        return (
            <div className="cards-played-tracker__container">
                <div className="cards-played-tracker cards-played-tracker--opponent">
                    <div className="stat-image undefined" style={ handImageStyle } />
                    <div className="cards-played-tracker__count" >{ otherPlayer && otherPlayer.cardsPlayedThisConflict || 0 }</div>
                </div>
                <div className="cards-played-tracker cards-played-tracker--me">
                    <div className="stat-image undefined" style={ handImageStyle } />
                    <div className="cards-played-tracker__count" >{ thisPlayer.cardsPlayedThisConflict || 0 }</div>
                </div>
            </div>
        );
    }

    getRingAttachments(thisPlayer, otherPlayer) {
        var opponentRingAttachments = !!otherPlayer && !!this.props.currentGame.rings && this.getControlledRingAttachments(Object.values(this.props.currentGame.rings), otherPlayer);
        var playerRingAttachments = !!thisPlayer && !!this.props.currentGame.rings && this.getControlledRingAttachments(Object.values(this.props.currentGame.rings), thisPlayer);

        return (<div className="ring-attachments__container">
            <div className="ring-attachments__container-inner">
                <div className="ring-attachments ring-attachments--opponent">
                    { Object.keys(opponentRingAttachments).map(key => this.renderRingAttachments(key, opponentRingAttachments[key], true)) }
                </div>
                <div className="ring-attachments ring-attachments--me">
                    { Object.keys(playerRingAttachments).map(key => this.renderRingAttachments(key, playerRingAttachments[key], true)) }
                </div>
            </div>
        </div>);
    }

    renderRingAttachments(element, attachments, amController) {
        let ringAttachmentWidthModifier = 0.8;
        let attachmentOffset = 13 * ringAttachmentWidthModifier;
        let cardLayer = 45;
        switch(this.props.user.settings.cardSize) {
            case "large":
                attachmentOffset *= 1.4;
                break;
            case "small":
                attachmentOffset *= 0.8;
                break;
            case "x-large":
                attachmentOffset *= 2;
                break;
        }

        return attachments.length
            ? <div id={ `ring-attachments-${element}` } className="ring-attachments--element" style={ {marginLeft: `${(attachments.length - 1) * attachmentOffset}px`} } >
                <img className="ring-attachments__ring-symbol" src={ `/img/military-${element}.png` } />
                {
                    attachments.map((card, index) => {
                        return (<div key={ card.uuid } className={ index !== 0 ? "ring-attachment--stacked" : "ring-attachment" } style={ {marginLeft: `${-1 * (index * attachmentOffset)}px`, zIndex: (cardLayer - index)} }>
                            <Card source="play area" card={ card } disableMouseOver={ card.facedown && !card.code }
                                onMenuItemClick={ this.onMenuItemClick } onMouseOver={ this.onMouseOver } onMouseOut={ this.onMouseOut }
                                showStats={ false }
                                onClick={ this.onCardClick } onDragDrop={ this.onDragDrop } size={ this.props.user.settings.cardSize } isMe={ amController }
                            />
                        </div>);
                    })
                }
            </div>
            : null;
    }

    getControlledRingAttachments(rings, player) {
        var ownedRingAttachments = [];
        var getOwnedAttachmentsByElement = (ownedAttachments, ring) => {
            ownedAttachments[ring.element] = (ring.attachments && ring.attachments.filter(card => this.isControlledByPlayer(card, player)));
            return ownedAttachments;
        };

        return rings.reduce(getOwnedAttachmentsByElement, ownedRingAttachments);
    }
    isControlledByPlayer(card, player) {
        return card.controller.name === player.name;
    }
    renderSidebar(thisPlayer, otherPlayer, visualSuggestions) {
        let size = this.props.user.settings.cardSize;
        return (
            <div className={ `province-pane ${size}` }>
                <div className="player-nameplate">
                    <Avatar emailHash={ otherPlayer && otherPlayer.user ? otherPlayer.user.emailHash : "unknown" } />
                    <div className="player-name">
                        { otherPlayer && otherPlayer.user ? otherPlayer.user.username : "Noone" }
                    </div>
                </div>
                <div className={ `sidebar-pane their-side ${size}` }>
                    { /* Cards this player cannot play copies of, hung under their honor
                         dial so the ban reads on the side it binds. */ }
                    <div className="sidebar-named-slot">
                        { thisPlayer.hideProvinceDeck && <HonorFan size={ size } value={ otherPlayer ? `${otherPlayer.showBid}` : "0" } /> }
                        <BlockedCards
                            cards={ resolveNamedCards(otherPlayer?.cannotPlayNamed, this.props.cards) }
                            onCardMouseOver={ this.onMouseOver }
                            onCardMouseOut={ this.onMouseOut } />
                    </div>
                    { this.getRings(otherPlayer ? otherPlayer.name : "\0", `claimed-pool their-pool ${size || ""}`) }
                    <div className="sidebar-pane their-side">
                        <PlayerStatsBox
                            clockState={ otherPlayer ? otherPlayer.clock : null }
                            stats={ otherPlayer ? otherPlayer.stats : null }
                            user={ otherPlayer ? otherPlayer.user : null }
                            firstPlayer={ otherPlayer && otherPlayer.firstPlayer }
                            handSize={ otherPlayer && otherPlayer.cardPiles.hand ? otherPlayer.cardPiles.hand.length : 0 }
                            otherPlayer
                            size={ size }
                            visualSuggestions={ visualSuggestions }
                        />
                    </div>
                </div>
                <div className="sidebar-pane our-side">
                    <PlayerStatsBox
                        { ...this.boundActions }
                        clockState={ thisPlayer.clock }
                        stats={ thisPlayer.stats }
                        showControls={ !this.state.spectating && this.props.currentGame.manualMode }
                        user={ thisPlayer.user }
                        firstPlayer={ thisPlayer.firstPlayer }
                        otherPlayer={ false }
                        spectating={ this.state.spectating }
                        size={ size }
                        visualSuggestions={ visualSuggestions }
                        handSize={ thisPlayer.cardPiles.hand ? thisPlayer.cardPiles.hand.length : 0 } />
                    { this.getRings(thisPlayer ? thisPlayer.name : "\0", `claimed-pool my-pool ${size || ""}`) }
                    <div className="sidebar-named-slot">
                        { thisPlayer.hideProvinceDeck && <HonorFan size={ size } value={ `${thisPlayer.showBid}` } /> }
                        <BlockedCards
                            cards={ resolveNamedCards(thisPlayer.cannotPlayNamed, this.props.cards) }
                            onCardMouseOver={ this.onMouseOver }
                            onCardMouseOut={ this.onMouseOut } />
                    </div>
                </div>
                <div className="player-nameplate our-side">
                    <Avatar emailHash={ thisPlayer.user ? thisPlayer.user.emailHash : "unknown" } />
                    <div className="player-name">
                        { thisPlayer.user ? thisPlayer.user.username : "Noone" }
                    </div>
                </div>
            </div>
        );
    }

    getPrompt(thisPlayer) {
        return (<div className="inset-pane">
            <ActivePlayerPrompt title={ thisPlayer.menuTitle }
                buttons={ thisPlayer.buttons }
                cards={ this.props.cards }
                controls={ thisPlayer.controls }
                promptTitle={ thisPlayer.promptTitle }
                onButtonClick={ this.onCommand }
                onMouseOver={ this.onMouseOver }
                onMouseOut={ this.onMouseOut }
                user={ this.props.user }
                onTimerExpired={ this.onTimerExpired }
                phase={ thisPlayer.phase } />
        </div>);
    }

    getPlayerHand(thisPlayer) {
        let defaultPosition = {
            x: (window.innerWidth / 2) - 240,
            y: (window.innerHeight / 2)
        };

        var handBounds = {
            left: 0,
            right: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) - 490,
            top: 0,
            bottom: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) - 160
        };

        if(!this.state.spectating) {
            return (<Draggable handle=".grip"
                nodeRef={ this.draggableRef }
                bounds= { handBounds }
                defaultPosition={ defaultPosition } >
                <div ref={ this.draggableRef } className="player-home-row-container">
                    <PlayerHand
                        cards={ thisPlayer.cardPiles.hand }
                        isMe={ !this.state.spectating }
                        onCardClick={ this.onCardClick }
                        onDragDrop={ this.onDragDrop }
                        onMouseOut={ this.onMouseOut }
                        onMouseOver={ this.onMouseOver }
                        cardSize={ this.props.user.settings.cardSize } />
                </div>
            </Draggable>);
        }
    }

    getOpponentHand(otherPlayer) {
        if(!otherPlayer || !otherPlayer.cardPiles.hand) {
            return null;
        }

        // Only show opponent hand if it has revealed cards (replay with hidden info)
        const hasRevealedCards = otherPlayer.cardPiles.hand.some(c => !c.facedown && c.id);
        if(!hasRevealedCards) {
            return null;
        }

        let defaultPosition = {
            x: (window.innerWidth / 2) - 240,
            y: 50
        };

        var handBounds = {
            left: 0,
            right: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) - 490,
            top: 0,
            bottom: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) - 160
        };

        return (<Draggable handle=".grip"
            nodeRef={ this.opponentDraggableRef }
            bounds={ handBounds }
            defaultPosition={ defaultPosition } >
            <div ref={ this.opponentDraggableRef } className="player-home-row-container opponent-hand-container">
                <PlayerHand
                    cards={ otherPlayer.cardPiles.hand }
                    isMe
                    onCardClick={ this.onCardClick }
                    onDragDrop={ this.onDragDrop }
                    onMouseOut={ this.onMouseOut }
                    onMouseOver={ this.onMouseOver }
                    cardSize={ this.props.user.settings.cardSize } />
            </div>
        </Draggable>);
    }

    render() {
        if(!this.props.currentGame) {
            return <div>Waiting for server...</div>;
        }

        let manualMode = this.props.currentGame.manualMode;
        const visualSuggestions = this.props.user.settings.optionSettings?.visualSuggestions !== false;

        let thisPlayer = this.props.currentGame.players[this.props.username];
        if(!thisPlayer) {
            thisPlayer = Object.values(this.props.currentGame.players).sort((a, b) => a.name.localeCompare(b.name))[0];
        }

        if(!thisPlayer) {
            return <div>Waiting for game to have players or close...</div>;
        }

        let otherPlayer = Object.values(this.props.currentGame.players).find(player => {
            return player.name !== thisPlayer.name;
        });

        let thisPlayerCards = [];
        let index = 0;
        let thisCardsInPlay = this.getCardsInPlay(thisPlayer, true);
        thisCardsInPlay.forEach(cards => {
            thisPlayerCards.push(<div className={ `card-row our-side player-home${thisPlayer && thisPlayer.imperialFavor ? " favor" : ""}` } key={ `this-loc${index++}` }>{ cards }</div>);
        });

        let otherPlayerCards = [];
        if(otherPlayer) {
            this.getCardsInPlay(otherPlayer, false).forEach(cards => {
                otherPlayerCards.push(<div className={ `card-row player-home${otherPlayer.imperialFavor ? " favor" : ""}` } key={ `other-loc${index++}` }>{ cards }</div>);
            });
        }

        // for(let i = thisPlayerCards.length; i < 2; i++) {
        //     thisPlayerCards.push(<div className="card-row player-home" key={ 'this-empty' + i } />);
        // }

        // for(let i = otherPlayerCards.length; i < 2; i++) {
        //     thisPlayerCards.push(<div className="card-row player-home" key={ 'other-empty' + i } />);
        // }

        let popup = (
            <div id="settings-modal" ref={ this.modalRef } className={ `modal fade ${this.state.showSettingsModal ? "in" : ""}` } style={ { display: this.state.showSettingsModal ? "block" : "none" } } tabIndex="-1" role="dialog">
                <div className="modal-dialog" role="document">
                    <div className="modal-content settings-popup row">
                        <div className="modal-header">
                            <button type="button" className="close" aria-label="Close" onClick={ () => this.setState({ showSettingsModal: false }) }><span aria-hidden="true">×</span></button>
                            <h4 className="modal-title">Game Configuration</h4>
                        </div>
                        <div className="modal-body col-xs-12">
                            <GameConfiguration actionWindows={ thisPlayer.promptedActionWindows } timerSettings={ thisPlayer.timerSettings }
                                optionSettings={ thisPlayer.optionSettings } onOptionSettingToggle={ this.onOptionSettingToggle.bind(this) }
                                onToggle={ this.onPromptedActionWindowToggle.bind(this) } onTimerSettingToggle={ this.onTimerSettingToggle.bind(this) }
                                spotlightEnabled={ this.state.spotlightEnabled } onSpotlightToggle={ this.onSpotlightToggle }
                            />
                        </div>
                    </div>
                </div>
            </div>);

        let backdrop = this.state.showSettingsModal ? <div className="modal-backdrop fade in" onClick={ () => this.setState({ showSettingsModal: false }) } /> : null;

        return (
            <div className={ `game-board${this.state.slamEffect?.variant === "military" ? " screen-shake" : ""}${this.state.spotlightEnabled ? " spotlight-active" : ""}` }>
                { popup }
                { backdrop }
                <CardPlaySpotlight events={ this.state.spotlightEvents } enabled={ this.state.spotlightEnabled } />
                { this.state.spotlightEnabled ? (
                    <ConflictArrows
                        conflict={ this.props.currentGame.conflict }
                        players={ [thisPlayer, otherPlayer] }
                        viewerPlayerName={ thisPlayer.name } />
                ) : null }
                <NamedCardMarkers
                    namedCards={ resolveNamedCards(
                        [...(thisPlayer.namedCards || []), ...(otherPlayer?.namedCards || [])],
                        this.props.cards
                    ) }
                    onCardMouseOver={ this.onMouseOver }
                    onCardMouseOut={ this.onMouseOut } />
                { this.state.showHistory ? (
                    <GameHistory
                        messages={ this.props.currentGame.messages }
                        conflictLedger={ this.state.conflictLedger }
                        onCardMouseOver={ this.onMouseOver }
                        onCardMouseOut={ this.onMouseOut }
                        onClose={ this.onHistoryClose } />
                ) : null }
                { this.state.slamEffect ? (
                    <ConflictSlamEffect
                        key={ this.state.slamEffect.key }
                        variant={ this.state.slamEffect.variant }
                        onDone={ this.clearSlamEffect } />
                ) : null }
                { this.getPrompt(thisPlayer) }
                { this.getPlayerHand(thisPlayer) }
                { this.getOpponentHand(otherPlayer) }
                { /* Disabled: status in sidebar
                    !thisPlayer.optionSettings.showStatusInSidebar &&
                    <div className="player-stats-row">
                        <PlayerStatsRow
                            clockState={ otherPlayer ? otherPlayer.clock : null }
                            stats={ otherPlayer ? otherPlayer.stats : null }
                            user={ otherPlayer ? otherPlayer.user : null }
                            firstPlayer={ otherPlayer && otherPlayer.firstPlayer }
                            otherPlayer
                            handSize={ otherPlayer && otherPlayer.cardPiles.hand ? otherPlayer.cardPiles.hand.length : 0 }
                        />
                    </div>
                */ }
                <div className={ `main-window ${this.props.user.settings.cardSize}` }>
                    { this.renderSidebar(thisPlayer, otherPlayer, visualSuggestions) }
                    <div className={ `play-area${this.props.user.settings.cardSize ? ` ${this.props.user.settings.cardSize}` : ""}` }>
                        <div className={ `player-board their-side${this.props.user.settings.cardSize ? ` ${this.props.user.settings.cardSize}` : ""}` }>
                            <div className="player-deck-row">
                                <DynastyRow
                                    conflictDiscardPile={ otherPlayer ? otherPlayer.cardPiles.conflictDiscardPile : [] }
                                    conflictDeck={ otherPlayer ? otherPlayer.cardPiles.conflictDeck : [] }
                                    conflictDeckTopCard={ otherPlayer ? otherPlayer.conflictDeckTopCard : null }
                                    dynastyDiscardPile={ otherPlayer ? otherPlayer.cardPiles.dynastyDiscardPile : [] }
                                    dynastyDeck={ otherPlayer ? otherPlayer.cardPiles.dynastyDeck : [] }
                                    dynastyDeckTopCard={ otherPlayer ? otherPlayer.dynastyDeckTopCard : null }
                                    removedFromGame={ otherPlayer ? otherPlayer.cardPiles.removedFromGame : [] }
                                    numConflictCards={ otherPlayer ? otherPlayer.numConflictCards : 0 }
                                    numDynastyCards={ otherPlayer ? otherPlayer.numDynastyCards : 0 }
                                    province1Cards={ otherPlayer ? otherPlayer.provinces.one : [] }
                                    province2Cards={ otherPlayer ? otherPlayer.provinces.two : [] }
                                    province3Cards={ otherPlayer ? otherPlayer.provinces.three : [] }
                                    province4Cards={ otherPlayer ? otherPlayer.provinces.four : [] }
                                    onCardClick={ this.onCardClick }
                                    onMouseOver={ this.onMouseOver }
                                    onMouseOut={ this.onMouseOut }
                                    otherPlayer= { otherPlayer }
                                    isSkirmish = { this.props.currentGame.skirmishMode || this.props.currentGame.gameMode === GameModes.Skirmish }
                                    visualSuggestions={ visualSuggestions }
                                    cardSize={ this.props.user.settings.cardSize } />
                            </div>
                            { otherPlayerCards }
                            <StrongholdRow
                                onCardClick={ this.onCardClick }
                                onMouseOver={ this.onMouseOver }
                                onMouseOut={ this.onMouseOut }
                                otherPlayer= { otherPlayer }
                                strongholdProvinceCards={ otherPlayer ? otherPlayer.strongholdProvince : [] }
                                role={ otherPlayer ? otherPlayer.role : null }
                                isSkirmish = { this.props.currentGame.skirmishMode || this.props.currentGame.gameMode === GameModes.Skirmish }
                                cardSize={ this.props.user.settings.cardSize }
                            />
                        </div>
                        { this.renderCenterBar(thisPlayer, otherPlayer, this.props.currentGame.conflict) }
                        <div className={ `player-board our-side${this.props.user.settings.cardSize ? ` ${this.props.user.settings.cardSize}` : ""}` } onDragOver={ this.onDragOver }
                            onDrop={ event => this.onDragDropEvent(event, "play area") } >
                            <StrongholdRow isMe={ !this.state.spectating }
                                spectating={ this.state.spectating }
                                onCardClick={ this.onCardClick }
                                onDragDrop={ this.onDragDrop }
                                onMenuItemClick={ this.onMenuItemClick }
                                onMouseOver={ this.onMouseOver }
                                onMouseOut={ this.onMouseOut }
                                strongholdProvinceCards={ thisPlayer.strongholdProvince }
                                role={ thisPlayer.role }
                                thisPlayer ={ thisPlayer }
                                isSkirmish = { this.props.currentGame.skirmishMode || this.props.currentGame.gameMode === GameModes.Skirmish }
                                cardSize={ this.props.user.settings.cardSize } />
                            {
                                !thisPlayer.hideProvinceDeck &&
                                <div className="province-group our-side no-highlight">
                                    <CardPile
                                        className="province-deck"
                                        title="Province Deck" source="province deck"
                                        cards={ thisPlayer.cardPiles.provinceDeck }
                                        hiddenTopCard
                                        onMouseOver={ this.onMouseOver }
                                        onMouseOut={ this.onMouseOut }
                                        onCardClick={ this.onCardClick }
                                        onDragDrop={ this.onDragDrop }
                                        disableMenu={ this.state.spectating }
                                        closeOnClick
                                        size={ this.props.user.settings.cardSize } />
                                </div>
                            }
                            { thisPlayerCards }
                            <div className="player-deck-row our-side">
                                <DynastyRow isMe={ !this.state.spectating }
                                    conflictDiscardPile={ thisPlayer.cardPiles.conflictDiscardPile }
                                    conflictDeck={ thisPlayer.cardPiles.conflictDeck }
                                    conflictDeckTopCard={ thisPlayer.conflictDeckTopCard }
                                    dynastyDiscardPile={ thisPlayer.cardPiles.dynastyDiscardPile }
                                    dynastyDeck={ thisPlayer.cardPiles.dynastyDeck }
                                    dynastyDeckTopCard={ thisPlayer.dynastyDeckTopCard }
                                    removedFromGame={ thisPlayer.cardPiles.removedFromGame }
                                    onCardClick={ this.onCardClick }
                                    onConflictClick={ this.onConflictClick }
                                    onDynastyClick={ this.onDynastyClick }
                                    onMouseOver={ this.onMouseOver }
                                    onMouseOut={ this.onMouseOut }
                                    manualMode={ manualMode }
                                    numConflictCards={ thisPlayer.numConflictCards }
                                    numDynastyCards={ thisPlayer.numDynastyCards }
                                    onConflictShuffleClick={ this.onConflictShuffleClick }
                                    onDynastyShuffleClick={ this.onDynastyShuffleClick }
                                    province1Cards={ thisPlayer.provinces.one }
                                    province2Cards={ thisPlayer.provinces.two }
                                    province3Cards={ thisPlayer.provinces.three }
                                    province4Cards={ thisPlayer.provinces.four }
                                    showConflictDeck={ this.state.showConflictDeck }
                                    showDynastyDeck={ this.state.showDynastyDeck }
                                    onDragDrop={ this.onDragDrop }
                                    spectating={ this.state.spectating }
                                    onMenuItemClick={ this.onMenuItemClick }
                                    isSkirmish = { this.props.currentGame.skirmishMode || this.props.currentGame.gameMode === GameModes.Skirmish }
                                    visualSuggestions={ visualSuggestions }
                                    cardSize={ this.props.user.settings.cardSize } />
                            </div>
                        </div>
                    </div>
                    <div className={ `right-side${this.state.showHistory ? " right-side--above-modal" : ""}` }>
                        <CardZoom imageUrl={ this.props.cardToZoom ? this.getCardImageUrl(this.props.cardToZoom) : "" }
                            orientation={ this.props.cardToZoom ? this.props.cardToZoom.type === "plot" ? "horizontal" : "vertical" : "vertical" }
                            show={ !!this.props.cardToZoom } cardName={ this.props.cardToZoom ? this.props.cardToZoom.name : null } />
                        <Chat
                            visible={ this.state.showChat }
                            messages={ this.props.currentGame.messages }
                            onMouseOver={ this.onMouseOver }
                            onMouseOut={ this.onMouseOut }
                            sendMessage={ this.sendMessage }
                        />
                        <Controls
                            onSettingsClick={ this.onSettingsClick }
                            onHistoryClick={ this.onHistoryClick }
                            onManualModeClick={ this.onManualModeClick }
                            onDownloadLogClick={ this.onDownloadLogClick }
                            onToggleChatClick={ this.onToggleChatClick }
                            onShowBotHandClick={ this.onShowBotHandClick }
                            onCaptureStateClick={ this.onCaptureStateClick }
                            onTestAnimationClick={ this.onTestAnimationClick }
                            onToggleWinEffectsClick={ this.onToggleWinEffectsClick }
                            musicActive={ !!this.props.currentGame.started && !this.props.currentGame.winner }
                            showDownloadLog={ !!this.props.currentGame.winner }
                            showChatAlert={ this.state.showChatAlert }
                            manualModeEnabled={ manualMode }
                            showManualMode={ !this.state.spectating }
                            showBotHandButton={ !this.state.spectating && !!otherPlayer?.user?.isBot }
                            botHandRevealed={ !!this.props.currentGame.showBotHand }
                            showAnimationTest
                            showWinEffectsToggle
                            showMusicControl={ !this.props.replayMode && !!this.props.currentGame.started && !this.props.currentGame.winner }
                            winEffectsEnabled={ this.state.winEffectsEnabled }
                            animationTestVariant={ this.state.animationTestVariant }
                        />
                    </div>
                </div>
                { /* Disabled: status in sidebar
                    !thisPlayer.optionSettings.showStatusInSidebar &&
                    <div className="player-stats-row our-side">
                        <PlayerStatsRow
                            { ...this.boundActions }
                            clockState={ thisPlayer.clock }
                            stats={ thisPlayer.stats }
                            showControls={ !this.state.spectating && manualMode }
                            user={ thisPlayer.user }
                            firstPlayer={ thisPlayer.firstPlayer }
                            otherPlayer={ false }
                            spectating={ this.state.spectating }
                            handSize={ thisPlayer.cardPiles.hand ? thisPlayer.cardPiles.hand.length : 0 } />
                    </div>
                */ }
            </div>);
    }
}

InnerGameBoard.displayName = "GameBoard";

function mapStateToProps(state) {
    return {
        cardToZoom: state.cards.zoomCard,
        cards: state.cards.cards,
        currentGame: state.games.currentGame,
        socket: state.socket.socket,
        user: state.auth.user,
        username: state.auth.username
    };
}

function mapDispatchToProps(dispatch) {
    let boundActions = bindActionCreators(actions, dispatch);
    boundActions.dispatch = dispatch;

    return boundActions;
}

const GameBoard = connect(mapStateToProps, mapDispatchToProps, null, { withRef: true })(InnerGameBoard);

export default GameBoard;
