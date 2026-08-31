// Shows WHICH card a naming ability named, as a small card pinned beside the card that
// named it.
//
// A named card is a name, not a board object, so it has nowhere of its own to live on
// the board. This is an overlay anchored to the naming card's own DOM node -- the same
// id={card.uuid} handle the spotlight arrows use -- so it follows the stronghold
// wherever the layout puts it.

import { getCardImageUrl } from "../../cardImageUrl.js";
import type { ResolvedNamedCard } from "./namedCards";
import { useAnchorTick } from "./spotlightAnchors";

interface NamedCardMarkersProps {
    namedCards: ResolvedNamedCard[];
    onCardMouseOut?: () => void;
    onCardMouseOver?: (card: ResolvedNamedCard) => void;
}

// Wide enough to read the art and the name, narrow enough not to cover the card it
// belongs to. Cards are 154x215 in the spotlight rail; this is deliberately smaller.
const MARKER_WIDTH = 64;
const MARKER_HEIGHT = Math.round(MARKER_WIDTH * (215 / 154));
const GAP = 6;

interface MarkerRect {
    left: number;
    top: number;
}

function nonEmptyRect(element: Element | null): DOMRect | null {
    if(!element) {
        return null;
    }
    const rect = element.getBoundingClientRect();
    return rect.width === 0 && rect.height === 0 ? null : rect;
}

function clamp(value: number, max: number): number {
    return Math.max(0, Math.min(value, max));
}

/**
 * Where to put the marker for a card that named something.
 *
 * The stronghold row is `role | stronghold | favor` on our side and mirrored on the
 * opponent's, so BOTH horizontal neighbours of a stronghold are occupied -- parking the
 * marker beside it covered the imperial favor on one side and the role card on the
 * other. Under the role card is the free space on both sides, and the role slot is a
 * real element (`.rolecard`) so no offset has to be guessed.
 *
 * Anything naming from outside that row has no such neighbours, and keeps the simple
 * "beside it, flipped away from the viewport edge" placement.
 */
function markerRect(sourceUuid: string): MarkerRect | null {
    const element = document.getElementById(sourceUuid);
    const anchor = nonEmptyRect(element);
    if(!element || !anchor) {
        return null;
    }

    const roleSlot = nonEmptyRect(element.closest(".player-stronghold-row")?.querySelector(".rolecard") ?? null);
    if(roleSlot) {
        return {
            left: clamp(roleSlot.left + (roleSlot.width - MARKER_WIDTH) / 2, window.innerWidth - MARKER_WIDTH),
            top: clamp(roleSlot.bottom + GAP, window.innerHeight - MARKER_HEIGHT)
        };
    }

    const rightOf = anchor.right + GAP;
    return {
        left: rightOf + MARKER_WIDTH > window.innerWidth ? Math.max(0, anchor.left - GAP - MARKER_WIDTH) : rightOf,
        top: Math.max(0, anchor.top + (anchor.height - MARKER_HEIGHT) / 2)
    };
}

function NamedCardMarkers({ namedCards, onCardMouseOut, onCardMouseOver }: NamedCardMarkersProps) {
    const tick = useAnchorTick(namedCards.length > 0);

    if(namedCards.length === 0) {
        return null;
    }

    const markers = namedCards.flatMap((named, index) => {
        if(!named.sourceUuid || !named.id) {
            return [];
        }
        const rect = markerRect(named.sourceUuid);
        if(!rect) {
            return [];
        }
        return [{ key: `${named.sourceUuid}-${named.name}-${index}`, named, ...rect }];
    });

    if(markers.length === 0) {
        return null;
    }

    return (
        <div className="named-card-markers" aria-hidden="true" data-tick={ tick }>
            { markers.map(marker => (
                <div
                    key={ marker.key }
                    className="named-card-marker"
                    style={ {
                        left: `${marker.left}px`,
                        top: `${marker.top}px`,
                        width: `${MARKER_WIDTH}px`
                    } }
                    title={ `${marker.named.sourceName || "Named"}: ${marker.named.name}` }
                    onMouseOver={ () => onCardMouseOver && onCardMouseOver(marker.named) }
                    onMouseOut={ () => onCardMouseOut && onCardMouseOut() }
                >
                    <img
                        src={ getCardImageUrl(marker.named.id, marker.named.packId) }
                        alt={ marker.named.name }
                    />
                    <span className="named-card-marker__name">{ marker.named.name }</span>
                </div>
            )) }
        </div>
    );
}

NamedCardMarkers.displayName = "NamedCardMarkers";

export default NamedCardMarkers;
