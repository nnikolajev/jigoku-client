// Renders the card-play spotlight: the played card slides in beside the board's zoom
// pane with an arrow to each target it hit.
//
// Two earlier presentations (an in-place "beam" anchored to the source card, and a
// stacked "ribbon" strip) were trialled alongside this one and dropped. The ribbon's
// row styling lives on in the History popup, which is where a stacked list actually
// earns its place.

import type { SpotlightEvent } from "./cardPlaySpotlight";
import SpotlightRail from "./SpotlightRail.jsx";

export const SPOTLIGHT_STORAGE_KEY = "jigoku.cardPlaySpotlightMode";

// How long one entry stays on screen. The CSS fade-out delays must be kept in step.
export const SPOTLIGHT_DURATION_MS = 3000;

// Cap on simultaneously visible entries, so a long forced-ability chain does not paper
// over the board.
export const SPOTLIGHT_MAX_VISIBLE = 3;

// The stored value is still the old mode string rather than a boolean, so a browser
// holding "beam" or "ribbon" from the trial reads as on rather than as garbage. Only an
// explicit "off" disables it, and an unset value means on -- this ships enabled.
export function loadSpotlightEnabled(): boolean {
    try {
        return globalThis.localStorage?.getItem(SPOTLIGHT_STORAGE_KEY) !== "off";
    } catch{
        return true;
    }
}

export function saveSpotlightEnabled(enabled: boolean): void {
    try {
        globalThis.localStorage?.setItem(SPOTLIGHT_STORAGE_KEY, enabled ? "rail" : "off");
    } catch{
        // Storage can be unavailable in private browsing; the session still works.
    }
}

interface CardPlaySpotlightProps {
    enabled: boolean;
    events: SpotlightEvent[];
}

function CardPlaySpotlight({ enabled, events }: CardPlaySpotlightProps) {
    if(!enabled || events.length === 0) {
        return null;
    }
    return <SpotlightRail events={ events.slice(-SPOTLIGHT_MAX_VISIBLE) } />;
}

CardPlaySpotlight.displayName = "CardPlaySpotlight";

export default CardPlaySpotlight;
