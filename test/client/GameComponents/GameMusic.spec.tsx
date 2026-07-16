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

    it("mutes only its audio element and persists volume", () => {
        const { container } = render(<GameMusic active tracks={ ["/one.mp3"] } random={ () => 0 } />);
        const audio = container.querySelector("audio");

        fireEvent.click(screen.getByRole("button", { name: "Mute game music" }));
        expect(audio.muted).toBe(true);
        expect(window.localStorage.getItem(MUSIC_MUTED_STORAGE_KEY)).toBe("true");

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
