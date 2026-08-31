// EXPERIMENTAL: the History popup. The ribbon rows the in-game spotlight can show,
// but for the whole game, scrollable, with a banner at every round/phase boundary and
// the conflict declarations expanded into who attacked, who defended and who was
// covert-ed.
//
// Hovering any card here drives the board's own zoom pane -- the popup is laid out to
// the left of it and GameBoard raises it above the backdrop while the popup is open,
// so the big view is the same one the board uses.

import { useEffect, useMemo, useRef } from "react";
import { ArrowRight, Ban, EyeOff, Shield, Swords, X } from "lucide-react";

import { getCardImageUrl } from "../../cardImageUrl";
import { buildGameHistory } from "./gameHistory";
import type { CovertPair, HistoryConflictRow, HistoryNoteRow, HistoryPlayRow, HistoryRow } from "./gameHistory";
import type { ConflictLedgerEntry } from "./conflictLedger";
import type { SpotlightCard } from "./cardPlaySpotlight";

interface GameHistoryProps {
    conflictLedger: ConflictLedgerEntry[];
    messages: any[];
    onCardMouseOut: () => void;
    onCardMouseOver: (card: SpotlightCard) => void;
    onClose: () => void;
}

type HoverHandlers = Pick<GameHistoryProps, "onCardMouseOut" | "onCardMouseOver">;

function art(card: SpotlightCard, className: string, hover: HoverHandlers) {
    const common = {
        title: card.name,
        onMouseOver: () => hover.onCardMouseOver(card),
        onMouseOut: () => hover.onCardMouseOut()
    };
    if(card.type === "ring") {
        return <div className={ `${className} ring icon-element-${card.element}` } { ...common } />;
    }
    return <img className={ className } src={ getCardImageUrl(card.id, card.packId) } alt={ card.name } { ...common } />;
}

function participantGroup(label: string, cards: SpotlightCard[], modifier: string, icon: React.ReactNode, hover: HoverHandlers) {
    if(cards.length === 0) {
        return null;
    }
    return (
        <div className={ `game-history__group game-history__group--${modifier}` }>
            <span className="game-history__group-label">{ icon } { label }</span>
            <div className="game-history__group-cards">
                { cards.map(card => (
                    <span key={ `${modifier}-${card.uuid}` }>{ art(card, "spotlight-ribbon__art", hover) }</span>
                )) }
            </div>
        </div>
    );
}

// The engine never records who covert-ed whom, so an unpaired target is shown without
// a source rather than attributed to a guess.
function covertGroup(pairs: CovertPair[], hover: HoverHandlers) {
    if(pairs.length === 0) {
        return null;
    }
    return (
        <div className="game-history__group game-history__group--covert">
            <span className="game-history__group-label"><EyeOff size={ 12 } /> Covert</span>
            <div className="game-history__covert-pairs">
                { pairs.map(pair => (
                    <span className="game-history__covert-pair" key={ `covert-${pair.target.uuid}` }>
                        { pair.source ? (
                            <>
                                { art(pair.source, "spotlight-ribbon__art", hover) }
                                <span className="game-history__covert-verb">covert</span>
                            </>
                        ) : null }
                        <ArrowRight size={ 14 } />
                        { art(pair.target, "spotlight-ribbon__art", hover) }
                    </span>
                )) }
            </div>
        </div>
    );
}

function playRow(row: HistoryPlayRow, hover: HoverHandlers) {
    const { event } = row;
    return (
        <div className={ `spotlight-ribbon__row${event.cancels ? " spotlight-ribbon__row--cancel" : ""}` }>
            { event.cancels ? <span className="spotlight-ribbon__chain"><Ban size={ 14 } /></span> : null }
            { art(event.source, "spotlight-ribbon__art spotlight-ribbon__art--source", hover) }
            <div className="spotlight-ribbon__body">
                <div className="spotlight-ribbon__title">
                    <b>{ event.playerName }</b> { event.verb } <b>{ event.source.name }</b>
                </div>
                <div className="spotlight-ribbon__text">{ event.text }</div>
            </div>
            { event.targets.length > 0 ? (
                <span className="spotlight-ribbon__arrow"><ArrowRight size={ 18 } /></span>
            ) : null }
            <div className="spotlight-ribbon__targets">
                { event.targets.map(target => (
                    <span key={ target.uuid }>{ art(target, "spotlight-ribbon__art", hover) }</span>
                )) }
            </div>
        </div>
    );
}

function conflictRow(row: HistoryConflictRow, hover: HoverHandlers) {
    return (
        <div className={ `spotlight-ribbon__row spotlight-ribbon__row--conflict spotlight-ribbon__row--${row.conflictType || "neutral"}` }>
            <div className="game-history__conflict-head">
                <span className="spotlight-ribbon__chain"><Swords size={ 14 } /></span>
                { row.ring ? art(row.ring, "spotlight-ribbon__art spotlight-ribbon__art--source", hover) : null }
                <div className="spotlight-ribbon__body">
                    <div className="spotlight-ribbon__title">
                        <b>{ row.playerName }</b> declares a <b>{ row.conflictType }</b> conflict
                    </div>
                    <div className="spotlight-ribbon__text">{ row.text }</div>
                </div>
                { row.province ? (
                    <>
                        <span className="spotlight-ribbon__arrow"><ArrowRight size={ 18 } /></span>
                        <div className="spotlight-ribbon__targets">
                            { art(row.province, "spotlight-ribbon__art", hover) }
                        </div>
                    </>
                ) : null }
            </div>
            { participantGroup("Attackers", row.attackers, "attack", <Swords size={ 12 } />, hover) }
            { participantGroup("Defenders", row.defenders, "defend", <Shield size={ 12 } />, hover) }
            { covertGroup(row.covert, hover) }
        </div>
    );
}

function noteRow(row: HistoryNoteRow, hover: HoverHandlers) {
    return (
        <div className={ `spotlight-ribbon__row spotlight-ribbon__row--note${row.alertType ? ` spotlight-ribbon__row--${row.alertType}` : ""}` }>
            { art(row.cards[0], "spotlight-ribbon__art", hover) }
            <div className="spotlight-ribbon__body">
                <div className="spotlight-ribbon__text spotlight-ribbon__text--note">{ row.text }</div>
            </div>
            <div className="spotlight-ribbon__targets">
                { row.cards.slice(1).map(card => (
                    <span key={ card.uuid }>{ art(card, "spotlight-ribbon__art", hover) }</span>
                )) }
            </div>
        </div>
    );
}

function historyRow(row: HistoryRow, hover: HoverHandlers) {
    if(row.kind === "phase") {
        return <div className="game-history__phase">{ row.label }</div>;
    }
    if(row.kind === "conflict") {
        return conflictRow(row, hover);
    }
    if(row.kind === "play") {
        return playRow(row, hover);
    }
    if(row.kind === "note") {
        return noteRow(row, hover);
    }
    return (
        <div className={ `game-history__line${row.alertType ? ` game-history__line--${row.alertType}` : ""}` }>
            { row.text }
        </div>
    );
}

function GameHistory({ conflictLedger, messages, onCardMouseOut, onCardMouseOver, onClose }: GameHistoryProps) {
    const rows = useMemo(() => buildGameHistory(messages, conflictLedger), [messages, conflictLedger]);
    const hover: HoverHandlers = { onCardMouseOver, onCardMouseOut };
    const dialogRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    // Open on the newest entry: the question this answers is almost always "what just
    // happened", and the log is oldest-first.
    useEffect(() => {
        const body = bodyRef.current;
        if(body) {
            body.scrollTop = body.scrollHeight;
        }
    }, [rows]);

    // Escape closes, and Tab is kept inside the dialog -- without this the focus ring
    // walks off into the board behind the backdrop, where nothing is clickable.
    useEffect(() => {
        closeRef.current?.focus();

        const onKeyDown = (event: KeyboardEvent) => {
            if(event.key === "Escape") {
                event.stopPropagation();
                onClose();
                return;
            }
            if(event.key !== "Tab" || !dialogRef.current) {
                return;
            }
            const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
                "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
            );
            if(focusable.length === 0) {
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if(event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
                event.preventDefault();
                last.focus();
            } else if(!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKeyDown, true);
        return () => document.removeEventListener("keydown", onKeyDown, true);
    }, [onClose]);

    return (
        <>
            <div className="modal-backdrop fade in game-history__backdrop" onClick={ onClose } />
            <div className="game-history" role="dialog" aria-modal="true" aria-label="Game history" ref={ dialogRef }>
                <div className="game-history__header">
                    <h4>Game history</h4>
                    <span className="game-history__hint">Hover a card to zoom it on the right</span>
                    <button type="button" className="btn btn-transparent" aria-label="Close" onClick={ onClose } ref={ closeRef }>
                        <X size={ 18 } />
                    </button>
                </div>
                <div className="game-history__body" ref={ bodyRef }>
                    { rows.length === 0 ? (
                        <div className="game-history__empty">Nothing has happened yet.</div>
                    ) : rows.map(row => (
                        <div key={ row.key }>{ historyRow(row, hover) }</div>
                    )) }
                </div>
            </div>
        </>
    );
}

GameHistory.displayName = "GameHistory";

export default GameHistory;
