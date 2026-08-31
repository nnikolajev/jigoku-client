// Shows WHICH card a naming ability named, as a small card pinned beside the card that
// named it.
//
// A named card is a name, not a board object, so it has nowhere of its own to live on
// the board. This is an overlay anchored to the naming card's own DOM node -- the same
// id={card.uuid} handle the spotlight arrows use -- so it follows the stronghold
// wherever the layout puts it.

import { getCardImageUrl } from "../../cardImageUrl.js";
import type { ResolvedNamedCard } from "./namedCards";
import { anchorForUuid, useAnchorTick } from "./spotlightAnchors";

interface NamedCardMarkersProps {
    namedCards: ResolvedNamedCard[];
}

// Wide enough to read the art and the name, narrow enough not to cover the card it
// belongs to. Cards are 154x215 in the spotlight rail; this is deliberately smaller.
const MARKER_WIDTH = 64;
const MARKER_HEIGHT = Math.round(MARKER_WIDTH * (215 / 154));
const GAP = 6;

function NamedCardMarkers({ namedCards }: NamedCardMarkersProps) {
    const tick = useAnchorTick(namedCards.length > 0);

    if(namedCards.length === 0) {
        return null;
    }

    const markers = namedCards.flatMap((named, index) => {
        if(!named.sourceUuid || !named.id) {
            return [];
        }
        const anchor = anchorForUuid(named.sourceUuid);
        if(!anchor) {
            return [];
        }
        // Prefer the right of the naming card, and flip to its left when that would run
        // off the viewport.
        const rightOf = anchor.left + anchor.width + GAP;
        const left = rightOf + MARKER_WIDTH > window.innerWidth
            ? Math.max(0, anchor.left - GAP - MARKER_WIDTH)
            : rightOf;
        return [{
            key: `${named.sourceUuid}-${named.name}-${index}`,
            named,
            left,
            top: Math.max(0, anchor.top + (anchor.height - MARKER_HEIGHT) / 2)
        }];
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
