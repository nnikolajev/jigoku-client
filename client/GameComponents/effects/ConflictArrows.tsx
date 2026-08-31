// EXPERIMENTAL: marks who is in the running conflict, and what it is aimed at.
//
//  - every participating character gets a small swept arrow on the edge facing the
//    enemy -- red for attackers, blue for defenders (the MTG Arena "swoosh")
//  - the contested province gets crossed swords, which become a skull once the
//    conflict is winning by enough to break it
//
// Nothing in the conflict summary names the participants, but it does not have to:
// every participating card and the contested province publish `inConflict` (set in
// conflictflow.ts), and the summary publishes `attackingPlayerId` /
// `defendingPlayerId` against each player's own `id`. So a character's side is its
// controller's side, and `conflict.breaking` already says whether the province falls.

import { useEffect, useState } from "react";

import { anchorFor } from "./spotlightAnchors";
import type { AnchorRect } from "./spotlightAnchors";
import type { SpotlightCard } from "./cardPlaySpotlight";

interface ConflictArrowsProps {
    conflict: any;
    players: any[];
    viewerPlayerName?: string;
}

interface ParticipantMark {
    key: string;
    rect: AnchorRect;
    attacking: boolean;
    // true when the enemy is above this card on screen, so the chevron sits on its top
    // edge and points up.
    pointsUp: boolean;
}

const MARK_WIDTH = 46;
const MARK_HEIGHT = 22;

function asSpotlightCard(card: any): SpotlightCard {
    return { uuid: card.uuid, id: card.id, name: card.name, packId: card.packId, type: card.type };
}

function participatingCharacters(player: any): any[] {
    const cardsInPlay = player?.cardPiles?.cardsInPlay || [];
    return cardsInPlay.filter((card: any) => card && card.inConflict && card.uuid);
}

// The contested province is the only province card flagged inConflict. Provinces live
// in the four numbered piles plus the stronghold slot.
function contestedProvince(players: any[]): any | null {
    for(const player of players) {
        const piles: any[] = [
            ...Object.values(player?.provinces || {}),
            player?.strongholdProvince || []
        ];
        for(const pile of piles) {
            for(const card of pile || []) {
                if(card?.inConflict && card.uuid) {
                    return card;
                }
            }
        }
    }
    return null;
}

// The board keeps moving for the whole life of a conflict -- characters bow, bodies
// move in and out -- so anchors are re-measured on a slow poll rather than once.
function useConflictTick(active: boolean): void {
    const [, setTick] = useState(0);

    useEffect(() => {
        if(!active) {
            return;
        }
        const timer = setInterval(() => setTick(current => current + 1), 250);
        const bump = () => setTick(current => current + 1);
        window.addEventListener("resize", bump);
        window.addEventListener("scroll", bump, true);
        return () => {
            clearInterval(timer);
            window.removeEventListener("resize", bump);
            window.removeEventListener("scroll", bump, true);
        };
    }, [active]);
}

function ConflictArrows({ conflict, players, viewerPlayerName }: ConflictArrowsProps) {
    const declared = !!conflict?.declarationComplete;
    // Re-renders on a slow poll so the marks follow the cards; the value is unused.
    useConflictTick(declared);

    if(!declared) {
        return null;
    }

    const marks: ParticipantMark[] = [];
    for(const player of players) {
        if(!player) {
            continue;
        }
        const attacking = player.id === conflict.attackingPlayerId;
        if(!attacking && player.id !== conflict.defendingPlayerId) {
            continue;
        }
        // The viewer's own board is the bottom half, so their enemy is upwards.
        const pointsUp = player.name === viewerPlayerName;
        for(const card of participatingCharacters(player)) {
            const rect = anchorFor(asSpotlightCard(card));
            if(!rect) {
                continue;
            }
            // The key must NOT include the anchor tick: a changed key remounts the
            // element, which replays its entry animation -- at a 250ms tick that reads
            // as a permanent pulse. Position comes from `style` instead.
            marks.push({ key: card.uuid, rect, attacking, pointsUp });
        }
    }

    const province = contestedProvince(players);
    const provinceRect = province ? anchorFor(asSpotlightCard(province)) : null;

    if(marks.length === 0 && !provinceRect) {
        return null;
    }

    return (
        <div className="conflict-arrows" aria-hidden="true">
            { marks.map(mark => {
                const left = mark.rect.left + mark.rect.width / 2 - MARK_WIDTH / 2;
                // Sit just outside the card edge that faces the enemy.
                const top = mark.pointsUp
                    ? mark.rect.top - MARK_HEIGHT - 2
                    : mark.rect.top + mark.rect.height + 2;
                return (
                    <svg
                        key={ mark.key }
                        className={ `conflict-mark conflict-mark--${mark.attacking ? "attack" : "defend"}${mark.pointsUp ? "" : " conflict-mark--down"}` }
                        style={ { left: `${left}px`, top: `${top}px`, width: `${MARK_WIDTH}px`, height: `${MARK_HEIGHT}px` } }
                        viewBox="0 0 46 22"
                    >
                        { /* A swept arc with a chevron head at its apex, so it reads as an
                             arrow pointing at the enemy rather than as a plain arc. */ }
                        <path className="conflict-mark__arc" d="M4 20 Q 23 8 42 20" />
                        <path className="conflict-mark__head" d="M14 12 L23 2 L32 12" />
                    </svg>
                );
            }) }
            { provinceRect ? (
                <div
                    className={ `conflict-province-mark${conflict.breaking ? " conflict-province-mark--breaking" : ""}` }
                    style={ {
                        left: `${provinceRect.left + provinceRect.width / 2}px`,
                        top: `${provinceRect.top + provinceRect.height / 2}px`
                    } }
                    title={ conflict.breaking ? "This province will break" : "Province under attack" }
                >
                    { conflict.breaking ? "☠" : "⚔" }
                </div>
            ) : null }
        </div>
    );
}

ConflictArrows.displayName = "ConflictArrows";

export default ConflictArrows;
