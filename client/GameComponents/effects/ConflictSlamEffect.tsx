import { useEffect } from "react";

const EFFECT_DURATION_MS = 1300;

// Fullscreen flourish shown when a conflict resolves with high skill:
// a sword slash for military conflicts, a fist punch for political ones.
function ConflictSlamEffect({ variant, onDone }: { variant: "sword" | "fist"; onDone?: () => void }) {
    useEffect(() => {
        const timer = setTimeout(() => onDone && onDone(), EFFECT_DURATION_MS);
        return () => clearTimeout(timer);
    }, [onDone]);

    return (
        <div className={ `conflict-slam conflict-slam--${variant}` }>
            <div className="conflict-slam__flash" />
            { variant === "sword" ? (
                <>
                    <div className="conflict-slam__slash conflict-slam__slash--one" />
                    <div className="conflict-slam__slash conflict-slam__slash--two" />
                </>
            ) : (
                <>
                    <div className="conflict-slam__shockwave" />
                    <div className="conflict-slam__fist">👊</div>
                </>
            ) }
        </div>
    );
}

ConflictSlamEffect.displayName = "ConflictSlamEffect";

export default ConflictSlamEffect;
