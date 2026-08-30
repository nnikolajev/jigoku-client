interface CardUsedBadgeProps {
    /** Card name, for the tooltip and screen readers. */
    name?: string;
}

/**
 * Shown on a card in play whose every limited ability is spent for its current
 * period, so clicking it does nothing until that period resets.
 *
 * The server answers this on the card summary as `abilitiesExhausted`, read
 * straight off the engine's own `AbilityLimit.isAtMax` — the same check that
 * refuses the click — so the badge cannot disagree with what the game allows.
 *
 * It sits in the bottom-left of the card's on-screen footprint and never
 * rotates, so a bowed card (whose IMAGE is rotated 90 degrees inside the same
 * box) keeps the badge in the same corner and the same way up.
 */
function CardUsedBadge({ name }: CardUsedBadgeProps) {
    const title = name ? `${name}: ability already used` : "Ability already used";

    return (
        <div className="card-used-badge ignore-mouse-events">
            <img src="/img/card-used.png" title={ title } alt={ title } />
        </div>
    );
}

CardUsedBadge.displayName = "CardUsedBadge";

export default CardUsedBadge;
