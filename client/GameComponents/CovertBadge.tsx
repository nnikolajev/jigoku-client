interface CovertBadgeProps {
    /** Card name, for the tooltip and screen readers. */
    name?: string;
}

/**
 * Shown on a character that currently has the COVERT keyword, so the player can
 * see at a glance which bodies can bypass a defender.
 *
 * The server answers this on the card summary as `hasCovert`, read off the
 * engine's own keyword resolution — so a GRANTED covert counts (Tattooed
 * Wanderer while attached, Adept of the Waves during the contested element) and
 * a lost one does not, without the client knowing any card text.
 *
 * Do not confuse it with the summary's `covert` field, which is the opposite
 * reading: that card has BEEN chosen by an opposing covert character.
 *
 * It sits on the left edge just below the printed military and political
 * scrolls, at roughly their width. Like `CardUsedBadge` it is a SIBLING of the
 * card image rather than a child, so a bowed card — whose image rotates 90
 * degrees inside the same box — never rotates the badge with it.
 */
function CovertBadge({ name }: CovertBadgeProps) {
    const title = name ? `${name}: covert` : "Covert";

    return (
        <div className="covert-badge ignore-mouse-events">
            <img src="/img/covert.png" title={ title } alt={ title } />
        </div>
    );
}

CovertBadge.displayName = "CovertBadge";

export default CovertBadge;
