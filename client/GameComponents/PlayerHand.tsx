import { useEffect, useRef } from "react";

import Card from "./Card.jsx";
import { playCardFlip } from "./effects/gameSounds.js";
import { tryParseJSON } from "../util";

const EMPTY_STYLE = {};
const DEAL_STAGGER = 0.12; // seconds between each newly drawn card

interface PlayerHandProps {
    cardSize?: string;
    cards: any[];
    isMe?: boolean;
    onCardClick?: (card: any) => void;
    onDragDrop?: (card: any, source: string, target: string) => void;
    onMouseOut?: (card: any) => void;
    onMouseOver?: (card: any) => void;
}

function PlayerHand({ cardSize, cards, isMe, onCardClick, onDragDrop, onMouseOut, onMouseOver }: PlayerHandProps) {
    // Track hand contents across renders so freshly drawn cards can deal/flip in one by one.
    const seenUuidsRef = useRef<Set<string> | null>(null);
    const currentUuids = cards ? cards.map((card) => card.uuid).filter(Boolean) : [];
    const seenUuids = seenUuidsRef.current;
    // On first render treat everything as already present (avoid a full-hand deal on load/reconnect).
    const newUuids = seenUuids ? currentUuids.filter((uuid) => !seenUuids.has(uuid)) : [];
    const dealIndexByUuid = new Map<string, number>();
    newUuids.forEach((uuid, index) => dealIndexByUuid.set(uuid, index));

    useEffect(() => {
        seenUuidsRef.current = new Set(currentUuids);
        if(newUuids.length === 0) {
            return;
        }
        const timers = newUuids.map((_, index) =>
            setTimeout(() => playCardFlip(), index * DEAL_STAGGER * 1000)
        );
        return () => timers.forEach((timer) => clearTimeout(timer));
    });

    const handleDragOver = (event: React.DragEvent) => {
        (event.target as HTMLElement).classList.add("highlight-panel");
        event.preventDefault();
    };

    const handleDragLeave = (event: React.DragEvent) => {
        (event.target as HTMLElement).classList.remove("highlight-panel");
    };

    const handleDragDrop = (event: React.DragEvent, target: string) => {
        event.stopPropagation();
        event.preventDefault();

        (event.target as HTMLElement).classList.remove("highlight-panel");

        const cardData = event.dataTransfer.getData("Text");

        if(!cardData) {
            return;
        }

        const dragData = tryParseJSON(cardData);
        if(!dragData) {
            return;
        }

        if(onDragDrop) {
            onDragDrop(dragData.card, dragData.source, target);
        }
    };

    const getCardWidth = () => {
        switch(cardSize) {
            case "small":
                return 65 * 0.8;
            case "large":
                return 65 * 1.4;
            case "x-large":
                return 65 * 2;
            case "normal":
            default:
                return 65;
        }
    };

    const cardWidth = getCardWidth();

    let maxWidth: number;
    switch(cardSize) {
        case "small":
        case "large":
        case "x-large":
        case "xxl":
            maxWidth = cardWidth * 7.5;
            break;
        default:
            maxWidth = 480;
    }

    const needsSquish = cards && cards.length * cardWidth > maxWidth;

    const handCards = (() => {
        const handLength = cards ? cards.length : 0;
        let cardIndex = 1;
        let attachmentOffset = 13;

        switch(cardSize) {
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

        return cards?.map((card) => {
            let className = "";
            if(needsSquish) {
                className += " squish";
                if(cardIndex++ === handLength) {
                    className += " tail";
                    if(attachmentOffset > (480 / (cardWidth * handLength))) {
                        className += " nohide";
                    }
                }
            }

            const dealIndex = dealIndexByUuid.get(card.uuid);
            let cardStyle = EMPTY_STYLE as React.CSSProperties;
            if(dealIndex !== undefined) {
                className += " hand-deal";
                cardStyle = { "--deal-delay": `${dealIndex * DEAL_STAGGER}s` } as React.CSSProperties;
            }

            return (
                <Card
                    key={ card.uuid }
                    card={ card }
                    className={ className }
                    style={ cardStyle }
                    disableMouseOver={ !isMe }
                    source="hand"
                    onMouseOver={ onMouseOver }
                    onMouseOut={ onMouseOut }
                    onClick={ onCardClick }
                    onDragDrop={ onDragDrop }
                    size={ cardSize }
                />
            );
        }) || [];
    })();

    let className = "panel hand";
    let titleBarClassName = "hand-title-bar no-highlight";

    if(cardSize !== "normal") {
        className += ` ${cardSize}`;
        titleBarClassName += ` ${cardSize}`;
    }

    // Calculate dynamic width based on number of cards
    let handWidth = maxWidth;
    if(cards && !needsSquish) {
        handWidth = Math.max(cardWidth * cards.length, cardWidth);
    }

    if(needsSquish) {
        className += " squish";
    }

    const handStyle = { width: `${handWidth}px` };
    const titleBarStyle = { width: `${handWidth}px` };

    return (
        <div>
            <div className="grip">
                <div className={ titleBarClassName } style={ titleBarStyle }>
                    { `Hand (${handCards.length})` }
                </div>
            </div>
            <div
                className={ className }
                style={ handStyle }
                onDragLeave={ handleDragLeave }
                onDragOver={ handleDragOver }
                onDrop={ (event) => handleDragDrop(event, "hand") }
            >
                { handCards }
            </div>
        </div>
    );
}

PlayerHand.displayName = "PlayerHand";

export default PlayerHand;
