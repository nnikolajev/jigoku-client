import { useState } from "react";
import { Menu, AlertCircle, Wrench, Settings, Download, Eye, EyeOff, Camera, Sparkles, Volume2, VolumeX, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import GameMusic from "./GameMusic.jsx";

const CONTROLS_STORAGE_KEY = "jigoku.controlsExpanded";

// The bar sits over the play area, so it collapses to a single handle at the right edge
// and stays that way across games. Only an explicit "true" expands it: it ships
// collapsed. The chat below it is a separate control and is deliberately untouched.
function loadExpanded(): boolean {
    try {
        return globalThis.localStorage?.getItem(CONTROLS_STORAGE_KEY) === "true";
    } catch{
        return false;
    }
}

function saveExpanded(expanded: boolean): void {
    try {
        globalThis.localStorage?.setItem(CONTROLS_STORAGE_KEY, String(expanded));
    } catch{
        // Storage can be unavailable in private browsing; the session still works.
    }
}

interface ControlsProps {
    manualModeEnabled?: boolean;
    onDownloadLogClick?: () => void;
    onManualModeClick?: () => void;
    onSettingsClick?: () => void;
    onHistoryClick?: () => void;
    onToggleChatClick?: () => void;
    onShowBotHandClick?: () => void;
    onCaptureStateClick?: () => void;
    onTestAnimationClick?: () => void;
    onToggleWinEffectsClick?: () => void;
    musicActive?: boolean;
    showChatAlert?: boolean;
    showDownloadLog?: boolean;
    showManualMode?: boolean;
    showBotHandButton?: boolean;
    botHandRevealed?: boolean;
    showAnimationTest?: boolean;
    showWinEffectsToggle?: boolean;
    showMusicControl?: boolean;
    winEffectsEnabled?: boolean;
    animationTestVariant?: "military" | "political";
}

function Controls({
    manualModeEnabled,
    onDownloadLogClick,
    onManualModeClick,
    onSettingsClick,
    onHistoryClick,
    onToggleChatClick,
    onShowBotHandClick,
    onCaptureStateClick,
    onTestAnimationClick,
    onToggleWinEffectsClick,
    musicActive = false,
    showChatAlert,
    showDownloadLog,
    showManualMode,
    showBotHandButton,
    botHandRevealed,
    showAnimationTest,
    showWinEffectsToggle,
    showMusicControl = false,
    winEffectsEnabled = true,
    animationTestVariant = "military"
}: ControlsProps) {
    const laptopSize = window.innerWidth <= 1366;
    const [expanded, setExpanded] = useState(loadExpanded);

    const toggleExpanded = () => {
        const next = !expanded;
        saveExpanded(next);
        setExpanded(next);
    };

    return (
        <div className={ `controls panel${expanded ? "" : " controls--collapsed"}` }>
            <button
                type="button"
                className="btn btn-transparent controls__handle"
                aria-expanded={ expanded }
                aria-label={ expanded ? "Hide game controls" : "Show game controls" }
                title={ expanded ? "Hide controls" : "Show controls" }
                onClick={ toggleExpanded }
            >
                { expanded ? <ChevronRight size={ 18 } /> : <ChevronLeft size={ 18 } /> }
            </button>
            { /* Kept mounted so the bar can slide, and made inert while collapsed so the
                 hidden buttons stay out of the tab order. */ }
            <div className="controls__items" inert={ !expanded }>
                <button
                    className={ `btn btn-transparent${showChatAlert ? " with-alert" : ""}` }
                    aria-label="Toggle chat"
                    title="Toggle chat"
                    onClick={ onToggleChatClick }
                >
                    <Menu size={ 16 } />
                    { laptopSize ? "" : " Toggle Chat" }
                    { showChatAlert && <AlertCircle size={ 16 } /> }
                </button>
                { showManualMode && (
                    <button
                        className={ `btn btn-transparent ${manualModeEnabled ? "manual" : "auto"}` }
                        aria-label="Manual mode"
                        aria-pressed={ !!manualModeEnabled }
                        title={ `Manual mode ${manualModeEnabled ? "enabled" : "disabled"}` }
                        onClick={ onManualModeClick }
                    >
                        <Wrench size={ 16 } />
                        { laptopSize ? "" : ` Manual Mode ${manualModeEnabled ? " Enabled" : "Disabled"}` }
                    </button>
                ) }
                <button className="btn btn-transparent" aria-label="Settings" title="Settings" onClick={ onSettingsClick }>
                    <Settings size={ 16 } />
                    { laptopSize ? "" : " Settings" }
                </button>
                <button className="btn btn-transparent" aria-label="History" title="Card play history" onClick={ onHistoryClick }>
                    <ScrollText size={ 16 } />
                    { laptopSize ? "" : " History" }
                </button>
                { showMusicControl && <GameMusic active={ musicActive } compact={ laptopSize } /> }
                { showWinEffectsToggle && (
                    <button
                        type="button"
                        className={ `btn btn-transparent ${winEffectsEnabled ? "manual" : "auto"}` }
                        aria-label="Conflict win effects"
                        aria-pressed={ winEffectsEnabled }
                        title={ `Turn conflict win effects ${winEffectsEnabled ? "off" : "on"}` }
                        onClick={ onToggleWinEffectsClick }
                    >
                        { winEffectsEnabled ? <Volume2 size={ 16 } /> : <VolumeX size={ 16 } /> }
                        { laptopSize ? "" : ` Win FX ${winEffectsEnabled ? "On" : "Off"}` }
                    </button>
                ) }
                { showAnimationTest && (
                    <button
                        type="button"
                        className="btn btn-transparent"
                        aria-label={ `Test ${animationTestVariant} win animation` }
                        title={ `Test ${animationTestVariant} win animation` }
                        onClick={ onTestAnimationClick }
                    >
                        <Sparkles size={ 16 } />
                        { laptopSize ? "" : ` Test ${animationTestVariant === "military" ? "Military" : "Political"}` }
                    </button>
                ) }
                { showBotHandButton && (
                    <button
                        className={ `btn btn-transparent ${botHandRevealed ? "manual" : "auto"}` }
                        aria-label="Bot hand"
                        aria-pressed={ !!botHandRevealed }
                        title={ `Bot hand ${botHandRevealed ? "shown" : "hidden"}` }
                        onClick={ onShowBotHandClick }
                    >
                        { botHandRevealed ? <Eye size={ 16 } /> : <EyeOff size={ 16 } /> }
                        { laptopSize ? "" : ` Bot Hand ${botHandRevealed ? "Shown" : "Hidden"}` }
                    </button>
                ) }
                { showBotHandButton && (
                    <button className="btn btn-transparent" aria-label="Capture state" title="Capture state" onClick={ onCaptureStateClick }>
                        <Camera size={ 16 } />
                        { laptopSize ? "" : " Capture State" }
                    </button>
                ) }
                { showDownloadLog && (
                    <button className="btn btn-transparent" aria-label="Game log" title="Game log" onClick={ onDownloadLogClick }>
                        <Download size={ 16 } />
                        { laptopSize ? "" : " Game Log" }
                    </button>
                ) }
            </div>
        </div>
    );
}

Controls.displayName = "Controls";

export default Controls;
