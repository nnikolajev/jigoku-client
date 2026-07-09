import type { GameState } from "../types/game";

export function buildGameStateSnapshot(currentGame: GameState, capturedBy?: string): any {
    return {
        capturedAt: new Date().toISOString(),
        capturedBy: capturedBy || null,
        gameName: currentGame.name,
        gameMode: currentGame.gameMode,
        phase: currentGame.phase,
        manualMode: currentGame.manualMode,
        showBotHand: currentGame.showBotHand,
        conflict: currentGame.conflict || null,
        rings: currentGame.rings,
        players: currentGame.players
    };
}

function download(filename: string, contents: string, mimeType: string): void {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function snapshotFilename(currentGame: GameState): string {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
    const sanitize = (s: string) => (s || "game").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 40);
    return `${stamp}_${sanitize(currentGame.name)}_state.json`;
}

/**
 * Copies a full point-in-time game state snapshot to the clipboard for pasting into an LLM.
 * Falls back to downloading a .json file when clipboard access is unavailable.
 */
export async function captureGameStateSnapshot(currentGame: GameState, capturedBy?: string): Promise<"clipboard" | "download"> {
    const snapshot = buildGameStateSnapshot(currentGame, capturedBy);
    const json = JSON.stringify(snapshot, null, 2);

    try {
        if(!navigator.clipboard) {
            throw new Error("Clipboard API unavailable");
        }
        await navigator.clipboard.writeText(json);
        return "clipboard";
    } catch(_e) {
        download(snapshotFilename(currentGame), json, "application/json");
        return "download";
    }
}
