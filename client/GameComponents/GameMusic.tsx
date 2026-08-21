import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export const GAME_MUSIC_TRACKS = [
    "/music/track-1.mp3",
    "/music/track-2.mp3",
    "/music/track-3.mp3"
];

export const MUSIC_MUTED_STORAGE_KEY = "jigoku.gameMusicMuted";
export const MUSIC_VOLUME_STORAGE_KEY = "jigoku.gameMusicVolume";
export const MUSIC_START_END_BUFFER_SECONDS = 30 * 60;
export const VOLUME_POPOVER_CLOSE_DELAY_MS = 220;

const DEFAULT_MUSIC_VOLUME = 0.35;

function readMutedPreference(): boolean {
    try {
        return typeof window !== "undefined" && window.localStorage.getItem(MUSIC_MUTED_STORAGE_KEY) === "true";
    } catch{
        return false;
    }
}

function readVolumePreference(): number {
    try {
        const storedValue = window.localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY);
        if(storedValue === null) {
            return DEFAULT_MUSIC_VOLUME;
        }
        const stored = Number(storedValue);
        return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : DEFAULT_MUSIC_VOLUME;
    } catch{
        return DEFAULT_MUSIC_VOLUME;
    }
}

function savePreference(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value);
    } catch{
        // Storage can be unavailable in private browsing; current-session state still works.
    }
}

export function getRandomMusicStartTime(duration: number, random: () => number = Math.random): number {
    if(!Number.isFinite(duration) || duration <= MUSIC_START_END_BUFFER_SECONDS) {
        return 0;
    }

    const maximumStart = duration - MUSIC_START_END_BUFFER_SECONDS;
    return Math.max(0, Math.min(maximumStart, random() * maximumStart));
}

export function chooseInitialMusicTrack(trackCount: number, random: () => number = Math.random): number {
    if(trackCount <= 1) {
        return 0;
    }

    return Math.min(trackCount - 1, Math.floor(random() * trackCount));
}

interface GameMusicProps {
    active?: boolean;
    compact?: boolean;
    random?: () => number;
    tracks?: string[];
}

function GameMusic({
    active = true,
    compact = false,
    random = Math.random,
    tracks = GAME_MUSIC_TRACKS
}: GameMusicProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const initialSeekPendingRef = useRef(true);
    const failedTracksRef = useRef(0);
    const playStartedRef = useRef(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [trackIndex, setTrackIndex] = useState(() => chooseInitialMusicTrack(tracks.length, random));
    const [muted, setMuted] = useState(readMutedPreference);
    const [volume, setVolume] = useState(readVolumePreference);
    const [unavailable, setUnavailable] = useState(tracks.length === 0);
    const [volumeOpen, setVolumeOpen] = useState(false);

    const attemptPlay = useCallback(() => {
        const audio = audioRef.current;
        if(!active || muted || unavailable || !audio) {
            return;
        }

        void audio.play().then(() => {
            playStartedRef.current = true;
        }).catch(() => {
            // Browsers can block autoplay. First pointer or keyboard action retries playback.
            playStartedRef.current = false;
        });
    }, [active, muted, unavailable]);

    useEffect(() => {
        const audio = audioRef.current;
        if(!audio) {
            return;
        }

        audio.volume = volume;
    }, [volume]);

    useEffect(() => {
        const audio = audioRef.current;
        if(!audio) {
            return;
        }

        if(!active || muted) {
            audio.pause();
            playStartedRef.current = false;
        } else if(audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
            attemptPlay();
        }
    }, [active, attemptPlay, muted]);

    // The unmount cleanup strips `src` off the element. React only writes the `src`
    // attribute back when its value changes, so after a hot reload (or any effect
    // replay) the element would keep an empty source and error out forever. Re-assert
    // the wanted source whenever the element does not already carry it.
    useEffect(() => {
        const audio = audioRef.current;
        const wantedSource = tracks[trackIndex];
        if(!audio || !wantedSource || audio.getAttribute("src") === wantedSource) {
            return;
        }

        audio.setAttribute("src", wantedSource);
        audio.load();
    }, [trackIndex, tracks]);

    useEffect(() => {
        const resumeMusic = () => {
            if(!playStartedRef.current) {
                attemptPlay();
            }
        };

        document.addEventListener("pointerdown", resumeMusic, { passive: true });
        document.addEventListener("keydown", resumeMusic);
        return () => {
            document.removeEventListener("pointerdown", resumeMusic);
            document.removeEventListener("keydown", resumeMusic);
        };
    }, [attemptPlay]);

    useEffect(() => {
        const audio = audioRef.current;
        return () => {
            if(!audio) {
                return;
            }

            audio.pause();
            audio.removeAttribute("src");
        };
    }, []);

    const cancelVolumeClose = useCallback(() => {
        if(closeTimerRef.current !== null) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }, []);

    const openVolume = useCallback(() => {
        cancelVolumeClose();
        setVolumeOpen(true);
    }, [cancelVolumeClose]);

    // The popover floats above the button with a gap, so the pointer leaves the control
    // on its way there. Close on a delay instead of instantly, or the slider is
    // unreachable.
    const scheduleVolumeClose = useCallback(() => {
        cancelVolumeClose();
        closeTimerRef.current = setTimeout(() => {
            closeTimerRef.current = null;
            setVolumeOpen(false);
        }, VOLUME_POPOVER_CLOSE_DELAY_MS);
    }, [cancelVolumeClose]);

    useEffect(() => cancelVolumeClose, [cancelVolumeClose]);

    const handleLoadedMetadata = () => {
        const audio = audioRef.current;
        if(!audio) {
            return;
        }

        failedTracksRef.current = 0;
        setUnavailable(false);
        if(initialSeekPendingRef.current) {
            audio.currentTime = getRandomMusicStartTime(audio.duration, random);
            initialSeekPendingRef.current = false;
        }
        attemptPlay();
    };

    const handleEnded = () => {
        if(tracks.length === 0) {
            return;
        }

        playStartedRef.current = false;
        failedTracksRef.current = 0;
        setTrackIndex((current) => (current + 1) % tracks.length);
    };

    const handleError = () => {
        if(!active || tracks.length === 0) {
            return;
        }

        const audio = audioRef.current;
        console.warn("Game music track failed to load", {
            code: audio?.error?.code,
            message: audio?.error?.message,
            src: audio?.currentSrc || tracks[trackIndex]
        });

        playStartedRef.current = false;
        failedTracksRef.current += 1;
        if(failedTracksRef.current >= tracks.length) {
            setUnavailable(true);
            return;
        }

        setTrackIndex((current) => (current + 1) % tracks.length);
    };

    const retryPlayback = () => {
        const audio = audioRef.current;
        failedTracksRef.current = 0;
        initialSeekPendingRef.current = true;
        setUnavailable(false);
        if(!audio) {
            return;
        }

        const wantedSource = tracks[trackIndex];
        if(wantedSource) {
            audio.setAttribute("src", wantedSource);
        }
        audio.load();
    };

    const toggleMuted = () => {
        if(unavailable) {
            retryPlayback();
            return;
        }

        const nextMuted = !muted;
        setMuted(nextMuted);
        savePreference(MUSIC_MUTED_STORAGE_KEY, String(nextMuted));
    };

    const changeVolume = (event: ChangeEvent<HTMLInputElement>) => {
        const nextVolume = Number(event.target.value) / 100;
        setVolume(nextVolume);
        savePreference(MUSIC_VOLUME_STORAGE_KEY, String(nextVolume));
    };

    const noTracks = tracks.length === 0;
    const buttonLabel = unavailable
        ? noTracks ? "Game music unavailable" : "Retry game music"
        : muted ? "Resume game music" : "Pause game music";
    const buttonText = unavailable && !noTracks ? "Music Retry" : `Music ${muted ? "Paused" : "On"}`;

    return (
        <div
            className={ `music-control${volumeOpen ? " volume-open" : ""}` }
            onPointerEnter={ openVolume }
            onPointerLeave={ scheduleVolumeClose }
            onFocus={ openVolume }
            onBlur={ scheduleVolumeClose }
        >
            <button
                type="button"
                className={ `btn btn-transparent ${muted ? "auto" : "manual"}` }
                aria-label={ buttonLabel }
                aria-pressed={ muted }
                disabled={ noTracks }
                title={ buttonLabel }
                onClick={ toggleMuted }
            >
                { muted ? <VolumeX size={ 16 } /> : <Volume2 size={ 16 } /> }
                { compact ? "" : ` ${buttonText}` }
            </button>
            <div className="music-volume-popover" role="group" aria-label="Game music volume controls">
                <Volume2 size={ 16 } aria-hidden="true" />
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={ Math.round(volume * 100) }
                    aria-label="Game music volume"
                    onChange={ changeVolume }
                />
                <span>{ Math.round(volume * 100) }%</span>
            </div>
            { tracks.length > 0 ? (
                <audio
                    ref={ audioRef }
                    src={ tracks[trackIndex] }
                    preload="metadata"
                    aria-hidden="true"
                    onLoadedMetadata={ handleLoadedMetadata }
                    onEnded={ handleEnded }
                    onError={ handleError }
                />
            ) : null }
        </div>
    );
}

GameMusic.displayName = "GameMusic";

export default GameMusic;
