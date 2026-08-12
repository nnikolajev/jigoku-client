import type { GameState } from "./types/game";

interface RecordedState {
    state: any;
    timestamp: number;
}

let recording: RecordedState[] = [];
let hiddenInfo: any[] = [];
let isRecording = false;
let recordingGameId: string | null = null;

function resetFor(gameId: string | null): void {
    recording = [];
    hiddenInfo = [];
    recordingGameId = gameId;
}

/**
 * Begin (or continue) recording the game identified by `gameId`.
 *
 * The id matters: `clearRecording` only runs on `cleargamestate`, so a session
 * that plays several games back to back never resets in between. Without this
 * check the second game's snapshots append to the first game's, and the
 * downloaded log ends up carrying EVERY game of the session in `replayData`
 * while `hiddenInfo` holds only the current one — the two then disagree index
 * for index, and only the final block matches the log's own `plainText`.
 */
export function startRecording(gameId?: string | null): void {
    const id = gameId ?? null;
    if(isRecording && (id === null || id === recordingGameId)) {
        return;
    }
    resetFor(id);
    isRecording = true;
}

export function recordState(gameState: GameState): void {
    if(!isRecording) {
        return;
    }

    // Defence in depth for the same problem: snapshots also arrive on the
    // lobby socket, which never calls `startRecording`. A state from a
    // different game than the one being recorded starts that game cleanly
    // rather than appending to its predecessor.
    const id = (gameState as { id?: string })?.id ?? null;
    if(recordingGameId === null) {
        recordingGameId = id;
    } else if(id !== null && id !== recordingGameId) {
        resetFor(id);
    }

    recording.push({
        state: JSON.parse(JSON.stringify(gameState)),
        timestamp: Date.now()
    });
}

export function setHiddenInfo(data: any[]): void {
    if(!isRecording) {
        return;
    }
    hiddenInfo = data;
}

export function getRecording(): RecordedState[] {
    return recording;
}

export function getHiddenInfo(): any[] {
    return hiddenInfo;
}

export function clearRecording(): void {
    recording = [];
    hiddenInfo = [];
    recordingGameId = null;
    isRecording = false;
}
