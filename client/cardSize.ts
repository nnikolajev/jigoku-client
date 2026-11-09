// "auto" card size: pick a concrete size class from the window height, which is
// what limits the board (both sides plus the centre bar must fit vertically).
// ponytail: height-only thresholds tuned for iPad Pro 11" (834px) and common
// desktops; measure rows instead if a layout ever outgrows them.
const AUTO_SIZES: [maxHeight: number, size: string][] = [
    [700, "small"],
    [950, "normal"],
    [1250, "large"],
    [1450, "x-large"]
];

export function resolveCardSize(setting: string | undefined, windowHeight: number): string {
    if(setting !== "auto") {
        return setting || "normal";
    }
    const match = AUTO_SIZES.find(([maxHeight]) => windowHeight < maxHeight);
    return match ? match[1] : "xxl";
}
