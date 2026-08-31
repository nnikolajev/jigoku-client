// The cards a player currently cannot play copies of -- Gossip, Bayushi's Whisperers,
// Esteemed Tea House, Dai Tsuchi.
//
// Rendered in that player's own sidebar strip, so the ban reads on the side of the
// player it binds. The server derives the list from the live restriction, so a card
// appearing here can be played again the moment it disappears.

import { getCardImageUrl } from "../../cardImageUrl.js";
import type { ResolvedNamedCard } from "./namedCards";

interface BlockedCardsProps {
    cards: ResolvedNamedCard[];
}

function BlockedCards({ cards }: BlockedCardsProps) {
    if(cards.length === 0) {
        return null;
    }

    return (
        <div className="blocked-cards">
            { cards.map(card => (
                <div
                    className="blocked-card"
                    key={ `${card.sourceName || ""}-${card.name}` }
                    title={ `Cannot play ${card.name}${card.sourceName ? ` (${card.sourceName})` : ""}` }
                >
                    { card.id ? (
                        <img src={ getCardImageUrl(card.id, card.packId) } alt={ card.name } />
                    ) : (
                        <span className="blocked-card__fallback">{ card.name }</span>
                    ) }
                    <svg className="blocked-card__cancel" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="5.5" y1="18.5" x2="18.5" y2="5.5" />
                    </svg>
                    <span className="sr-only">Cannot play { card.name }</span>
                </div>
            )) }
        </div>
    );
}

BlockedCards.displayName = "BlockedCards";

export default BlockedCards;
