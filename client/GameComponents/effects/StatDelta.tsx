import { useEffect, useRef, useState } from "react";

let nextDeltaId = 0;

interface DeltaEntry {
    id: number;
    amount: number;
}

// Tracks a numeric value across renders and returns short-lived +N/-N entries when it changes.
export function useValueDeltas(value: number | string | undefined): DeltaEntry[] {
    const numeric = typeof value === "number" ? value : null;
    const prevRef = useRef<number | null>(numeric);
    const [deltas, setDeltas] = useState<DeltaEntry[]>([]);

    useEffect(() => {
        const prev = prevRef.current;
        prevRef.current = numeric;
        if(prev === null || numeric === null || numeric === prev) {
            return;
        }

        const entry = { id: nextDeltaId++, amount: numeric - prev };
        setDeltas(current => [...current, entry]);
        const timer = setTimeout(() => {
            setDeltas(current => current.filter(delta => delta.id !== entry.id));
        }, 1400);
        return () => clearTimeout(timer);
    }, [numeric]);

    return deltas;
}

interface StatDeltaProps {
    value: number | string | undefined;
}

// Renders floating green +N / red -N indicators whenever the given value changes.
// The parent element needs the "stat-delta-host" class (position: relative).
function StatDelta({ value }: StatDeltaProps) {
    const deltas = useValueDeltas(value);

    if(deltas.length === 0) {
        return null;
    }

    return (
        <div className="stat-delta-anchor">
            { deltas.map((delta, index) => (
                <span
                    key={ delta.id }
                    className={ `stat-delta ${delta.amount > 0 ? "stat-delta--up" : "stat-delta--down"}` }
                    style={ index > 0 ? { marginTop: `${index * 14}px` } : undefined }
                >
                    { delta.amount > 0 ? `+${delta.amount}` : `${delta.amount}` }
                </span>
            )) }
        </div>
    );
}

StatDelta.displayName = "StatDelta";

export default StatDelta;
