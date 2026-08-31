// EXPERIMENTAL variant A -- "rail". Closest to the MTG Arena reference: the played
// card slides in on the right edge, newer entries stack over older ones, and a curved
// arrow runs from the rail card to each target still on the board. A cancel points at
// the rail card it is cancelling instead of at the board.

import { getCardImageUrl } from "../../cardImageUrl";
import type { SpotlightEvent } from "./cardPlaySpotlight";
import { anchorFor, centerOf, useAnchorTick } from "./spotlightAnchors";

interface SpotlightRailProps {
    events: SpotlightEvent[];
}

// The hover zoom pane (.card-large) is a hard 338px pinned to the right edge inside
// .right-side, with no responsive rule of its own. Parking the rail there put every
// spotlight card under whatever the pointer was zooming, so the rail starts to the LEFT
// of that pane -- and on a narrow window the CARDS shrink rather than the gutter, since
// the gutter is fixed by a pane that never shrinks.
const CARD_ZOOM_PANE_WIDTH = 338;
const RAIL_RIGHT = CARD_ZOOM_PANE_WIDTH + 14;
const RAIL_TOP = 96;
const CARD_ASPECT = 215 / 154;

interface RailMetrics {
    cardWidth: number;
    cardHeight: number;
    stackOffset: number;
}

export function railMetrics(viewportWidth: number): RailMetrics {
    // Below ~1280 the board itself is already tight, so give the rail the smallest size
    // that still reads as a card rather than letting it crowd the play area.
    const cardWidth = viewportWidth >= 1600 ? 154 : viewportWidth >= 1280 ? 132 : 112;
    return {
        cardWidth,
        cardHeight: Math.round(cardWidth * CARD_ASPECT),
        stackOffset: viewportWidth >= 1600 ? 30 : 24
    };
}

function railRect(index: number, metrics: RailMetrics) {
    const right = RAIL_RIGHT + index * metrics.stackOffset;
    return {
        left: window.innerWidth - right - metrics.cardWidth,
        top: RAIL_TOP + index * metrics.stackOffset,
        width: metrics.cardWidth,
        height: metrics.cardHeight
    };
}

function SpotlightRail({ events }: SpotlightRailProps) {
    // Also re-renders on resize, which is what makes railMetrics responsive.
    const tick = useAnchorTick(events.length > 0);

    if(events.length === 0) {
        return null;
    }

    const metrics = railMetrics(window.innerWidth);

    const arrows = events.flatMap((event, eventIndex) => {
        const rail = railRect(eventIndex, metrics);
        const from = { x: rail.left + 6, y: rail.top + rail.height / 2 };

        // A cancel has no board target worth pointing at -- the thing it answers is the
        // card sitting one slot below it on the rail.
        if(event.cancels && eventIndex > 0) {
            const below = railRect(eventIndex - 1, metrics);
            const to = { x: below.left + below.width / 2, y: below.top + 8 };
            return [{ key: `${event.key}-stackcancel`, from, to, cancels: true }];
        }

        return event.targets.flatMap((target, targetIndex) => {
            const rect = anchorFor(target);
            if(!rect) {
                return [];
            }
            return [{
                key: `${event.key}-${targetIndex}-${tick}`,
                from,
                to: centerOf(rect),
                cancels: event.cancels
            }];
        });
    });

    return (
        <div className="spotlight-rail" aria-hidden="true">
            <svg className="spotlight-overlay-svg">
                <defs>
                    <marker id="spotlight-rail-head" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                        <path d="M0,0 L7,3.5 L0,7 Z" className="spotlight-arrow-head" />
                    </marker>
                </defs>
                { arrows.map(arrow => {
                    const midX = (arrow.from.x + arrow.to.x) / 2;
                    const bowY = Math.min(arrow.from.y, arrow.to.y) - 60;
                    return (
                        <path
                            key={ arrow.key }
                            className={ `spotlight-arrow${arrow.cancels ? " spotlight-arrow--cancel" : ""}` }
                            d={ `M ${arrow.from.x} ${arrow.from.y} Q ${midX} ${bowY} ${arrow.to.x} ${arrow.to.y}` }
                            markerEnd="url(#spotlight-rail-head)"
                        />
                    );
                }) }
            </svg>
            { events.map((event, index) => (
                <div
                    key={ event.key }
                    className={ `spotlight-rail__card${event.cancels ? " spotlight-rail__card--cancel" : ""}` }
                    style={ {
                        right: `${RAIL_RIGHT + index * metrics.stackOffset}px`,
                        top: `${RAIL_TOP + index * metrics.stackOffset}px`,
                        width: `${metrics.cardWidth}px`
                    } }
                >
                    <img src={ getCardImageUrl(event.source.id, event.source.packId) } alt={ event.source.name } />
                    <div className="spotlight-rail__caption">
                        <span className="spotlight-rail__player">{ event.playerName }</span>
                        <span className="spotlight-rail__verb">{ event.verb }</span>
                    </div>
                </div>
            )) }
        </div>
    );
}

SpotlightRail.displayName = "SpotlightRail";

export default SpotlightRail;
