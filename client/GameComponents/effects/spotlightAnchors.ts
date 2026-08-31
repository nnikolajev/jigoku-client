// EXPERIMENTAL: resolves a spotlight card to its live position on the board.
//
// Play-area cards, provinces and attachments all render with id={card.uuid}
// (GameBoard.tsx / Province.tsx / Card.tsx), which is the same handle Messages.tsx
// uses to highlight a card from the log. Rings carry no DOM id, so they fall back to
// their element class.

import { useEffect, useState } from "react";

import type { SpotlightCard } from "./cardPlaySpotlight";

export interface AnchorRect {
    uuid: string;
    left: number;
    top: number;
    width: number;
    height: number;
}

function elementFor(card: SpotlightCard): Element | null {
    const byUuid = document.getElementById(card.uuid);
    if(byUuid) {
        return byUuid;
    }
    if(card.type === "ring" && card.element) {
        return document.querySelector(`.ring.icon-element-${card.element}`);
    }
    return null;
}

function rectOf(element: Element | null, uuid: string): AnchorRect | null {
    if(!element) {
        return null;
    }
    const rect = element.getBoundingClientRect();
    if(rect.width === 0 && rect.height === 0) {
        return null;
    }
    return { uuid, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

export function anchorFor(card: SpotlightCard): AnchorRect | null {
    return rectOf(elementFor(card), card.uuid);
}

/** Same lookup for a bare uuid, where there is no card summary to pass. */
export function anchorForUuid(uuid: string): AnchorRect | null {
    return rectOf(document.getElementById(uuid), uuid);
}

export interface AnchorPoint {
    x: number;
    y: number;
}

export function centerOf(rect: AnchorRect): AnchorPoint {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Board layout settles a frame or two after the state update that produced the log
// entry, and the play area scrolls, so anchors are re-read on a short poll for the
// life of the overlay rather than measured once.
export function useAnchorTick(active: boolean, intervalMs = 120): number {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if(!active) {
            return;
        }
        const timer = setInterval(() => setTick(current => current + 1), intervalMs);
        const bump = () => setTick(current => current + 1);
        window.addEventListener("resize", bump);
        window.addEventListener("scroll", bump, true);
        return () => {
            clearInterval(timer);
            window.removeEventListener("resize", bump);
            window.removeEventListener("scroll", bump, true);
        };
    }, [active, intervalMs]);

    return tick;
}
