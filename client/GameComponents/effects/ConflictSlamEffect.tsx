import { useEffect } from "react";

export type ConflictSlamVariant = "military" | "political";

const EFFECT_DURATION_MS: Record<ConflictSlamVariant, number> = {
    military: 1400,
    political: 2300
};

// Fullscreen, presentation-only flourish shown when a province breaks by a large margin.
function ConflictSlamEffect({ variant, onDone }: { variant: ConflictSlamVariant; onDone?: () => void }) {
    useEffect(() => {
        const timer = setTimeout(() => onDone && onDone(), EFFECT_DURATION_MS[variant]);
        return () => clearTimeout(timer);
    }, [onDone, variant]);

    return (
        <div className={ `conflict-slam conflict-slam--${variant}` } aria-hidden="true">
            <div className="conflict-slam__flash" />
            { variant === "military" ? (
                <>
                    <div className="conflict-slam__slash conflict-slam__slash--one" />
                    <div className="conflict-slam__slash conflict-slam__slash--two" />
                    <div className="conflict-slam__shockwave" />
                    <div className="conflict-slam__fist">👊</div>
                </>
            ) : (
                <>
                    <div className="conflict-slam__wind">
                        { Array.from({ length: 6 }, (_, index) => <span key={ index } />) }
                    </div>
                    <div className="conflict-slam__fan">
                        <div className="conflict-slam__fan-leaf" />
                        <div className="conflict-slam__fan-ribs" />
                        <div className="conflict-slam__fan-guard conflict-slam__fan-guard--left" />
                        <div className="conflict-slam__fan-guard conflict-slam__fan-guard--right" />
                        <div className="conflict-slam__fan-pivot" />
                    </div>
                </>
            ) }
        </div>
    );
}

ConflictSlamEffect.displayName = "ConflictSlamEffect";

export default ConflictSlamEffect;
