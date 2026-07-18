import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import GameMusic, {
    MUSIC_MUTED_STORAGE_KEY,
    MUSIC_VOLUME_STORAGE_KEY,
    chooseInitialMusicTrack,
    getRandomMusicStartTime
} from "../../../client/GameComponents/GameMusic.jsx";

describe("the <GameMusic /> component", () => {
    let playMock;
    let pauseMock;

    beforeEach(() => {
        window.localStorage.clear();
        playMock = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
        pauseMock = vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("chooses an initial track and seeks no later than 30 minutes before its end", async () => {
        const { container } = render(
            <GameMusic active tracks={ ["/one.mp3", "/two.mp3", "/three.mp3"] } random={ () => 0.5 } />
        );
        const audio = container.querySelector("audio");
        Object.defineProperty(audio, "duration", { configurable: true, value: 7200 });

        expect(audio.getAttribute("src")).toBe("/two.mp3");
        fireEvent.loadedMetadata(audio);

        expect(audio.currentTime).toBe(2700);
        await waitFor(() => expect(playMock).toHaveBeenCalled());
    });

    it("rotates to the next track when the current track ends", async () => {
        const { container } = render(
            <GameMusic active tracks={ ["/one.mp3", "/two.mp3", "/three.mp3"] } random={ () => 0 } />
        );
        const audio = container.querySelector("audio");

        expect(audio.getAttribute("src")).toBe("/one.mp3");
        fireEvent.ended(audio);

        await waitFor(() => expect(audio.getAttribute("src")).toBe("/two.mp3"));
    });

    it("pauses and resumes music instead of muting audio", async () => {
        const { container } = render(<GameMusic active tracks={ ["/one.mp3"] } random={ () => 0 } />);
        const audio = container.querySelector("audio");

        Object.defineProperty(audio, "readyState", { configurable: true, value: HTMLMediaElement.HAVE_METADATA });
        fireEvent.loadedMetadata(audio);
        await waitFor(() => expect(playMock).toHaveBeenCalled());
        playMock.mockClear();

        fireEvent.click(screen.getByRole("button", { name: "Pause game music" }));
        expect(pauseMock).toHaveBeenCalled();
        expect(audio.muted).toBe(false);
        expect(window.localStorage.getItem(MUSIC_MUTED_STORAGE_KEY)).toBe("true");

        fireEvent.pointerDown(document);
        expect(playMock).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Resume game music" }));
        await waitFor(() => expect(playMock).toHaveBeenCalled());
        expect(window.localStorage.getItem(MUSIC_MUTED_STORAGE_KEY)).toBe("false");
    });

    it("persists music volume", () => {
        const { container } = render(<GameMusic active tracks={ ["/one.mp3"] } random={ () => 0 } />);
        const audio = container.querySelector("audio");

        fireEvent.change(screen.getByRole("slider", { name: "Game music volume" }), { target: { value: "25" } });
        expect(audio.volume).toBe(0.25);
        expect(window.localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY)).toBe("0.25");
    });

    it("pauses playback when it becomes inactive and when it unmounts", () => {
        const { rerender, unmount } = render(<GameMusic active tracks={ ["/one.mp3"] } />);

        rerender(<GameMusic active={ false } tracks={ ["/one.mp3"] } />);
        expect(pauseMock).toHaveBeenCalled();

        const callsBeforeUnmount = pauseMock.mock.calls.length;
        unmount();
        expect(pauseMock.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);
    });

    it("keeps short tracks at their beginning", () => {
        expect(getRandomMusicStartTime(1200, () => 0.9)).toBe(0);
        expect(chooseInitialMusicTrack(3, () => 0.99)).toBe(2);
    });
});
