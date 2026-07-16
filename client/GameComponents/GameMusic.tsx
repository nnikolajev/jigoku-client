import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export const GAME_MUSIC_TRACKS = [
    "/music/track-1.mp3",
    "/music/track-2.mp3",
    "/music/track-3.mp3"
];

export const MUSIC_MUTED_STORAGE_KEY = "jigoku.gameMusicMuted";
export const MUSIC_VOLUME_STORAGE_KEY = "jigoku.gameMusicVolume";
export const MUSIC_START_END_BUFFER_SECONDS = 30 * 60;

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
    const [trackIndex, setTrackIndex] = useState(() => chooseInitialMusicTrack(tracks.length, random));
    const [muted, setMuted] = useState(readMutedPreference);
    const [volume, setVolume] = useState(readVolumePreference);
    const [unavailable, setUnavailable] = useState(tracks.length === 0);

    const attemptPlay = useCallback(() => {
        const audio = audioRef.current;
        if(!active || unavailable || !audio) {
            return;
        }

        void audio.play().then(() => {
            playStartedRef.current = true;
        }).catch(() => {
            // Browsers can block autoplay. First pointer or keyboard action retries playback.
            playStartedRef.current = false;
        });
    }, [active, unavailable]);

    useEffect(() => {
        const audio = audioRef.current;
        if(!audio) {
            return;
        }

        audio.muted = muted;
        audio.volume = volume;
    }, [muted, volume]);

    useEffect(() => {
        const audio = audioRef.current;
        if(!audio) {
            return;
        }

        if(!active) {
            audio.pause();
            playStartedRef.current = false;
        } else if(audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
            attemptPlay();
        }
    }, [active, attemptPlay]);

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

        playStartedRef.current = false;
        failedTracksRef.current += 1;
        if(failedTracksRef.current >= tracks.length) {
            setUnavailable(true);
            return;
        }

        setTrackIndex((current) => (current + 1) % tracks.length);
    };

    const toggleMuted = () => {
        if(unavailable) {
            return;
        }

        const nextMuted = !muted;
        setMuted(nextMuted);
        savePreference(MUSIC_MUTED_STORAGE_KEY, String(nextMuted));
        if(!nextMuted) {
            attemptPlay();
        }
    };

    const changeVolume = (event) => {
        const nextVolume = Number(event.target.value) / 100;
        setVolume(nextVolume);
        savePreference(MUSIC_VOLUME_STORAGE_KEY, String(nextVolume));
    };

    const buttonLabel = unavailable ? "Game music unavailable" : muted ? "Unmute game music" : "Mute game music";

    return (
        <div className="music-control">
            <button
                type="button"
                className={ `btn btn-transparent ${muted ? "auto" : "manual"}` }
                aria-label={ buttonLabel }
                aria-pressed={ muted }
                disabled={ unavailable }
                title={ buttonLabel }
                onClick={ toggleMuted }
            >
                { muted ? <VolumeX size={ 16 } /> : <Volume2 size={ 16 } /> }
                { compact ? "" : ` Music ${muted ? "Muted" : "On"}` }
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
                    disabled={ unavailable }
                    onChange={ changeVolume }
                />
                <span>{ Math.round(volume * 100) }%</span>
            </div>
            { tracks.length > 0 ? (
                <audio
                    ref={ audioRef }
                    src={ tracks[trackIndex] }
                    preload="auto"
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
