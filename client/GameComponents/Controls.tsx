import { Menu, AlertCircle, Wrench, Settings, Download, Eye, EyeOff, Camera, Sparkles, Volume2, VolumeX } from "lucide-react";

interface ControlsProps {
    manualModeEnabled?: boolean;
    onDownloadLogClick?: () => void;
    onManualModeClick?: () => void;
    onSettingsClick?: () => void;
    onToggleChatClick?: () => void;
    onShowBotHandClick?: () => void;
    onCaptureStateClick?: () => void;
    onTestAnimationClick?: () => void;
    onToggleWinEffectsClick?: () => void;
    showChatAlert?: boolean;
    showDownloadLog?: boolean;
    showManualMode?: boolean;
    showBotHandButton?: boolean;
    botHandRevealed?: boolean;
    showAnimationTest?: boolean;
    showWinEffectsToggle?: boolean;
    winEffectsEnabled?: boolean;
    animationTestVariant?: "military" | "political";
}

function Controls({
    manualModeEnabled,
    onDownloadLogClick,
    onManualModeClick,
    onSettingsClick,
    onToggleChatClick,
    onShowBotHandClick,
    onCaptureStateClick,
    onTestAnimationClick,
    onToggleWinEffectsClick,
    showChatAlert,
    showDownloadLog,
    showManualMode,
    showBotHandButton,
    botHandRevealed,
    showAnimationTest,
    showWinEffectsToggle,
    winEffectsEnabled = true,
    animationTestVariant = "military"
}: ControlsProps) {
    const laptopSize = window.innerWidth <= 1366;

    return (
        <div className="controls panel">
            <button
                className={ `btn btn-transparent${showChatAlert ? " with-alert" : ""}` }
                onClick={ onToggleChatClick }
            >
                <Menu size={ 16 } />
                { laptopSize ? "" : " Toggle Chat" }
                { showChatAlert && <AlertCircle size={ 16 } /> }
            </button>
            { showManualMode && (
                <button
                    className={ `btn btn-transparent ${manualModeEnabled ? "manual" : "auto"}` }
                    onClick={ onManualModeClick }
                >
                    <Wrench size={ 16 } />
                    { laptopSize ? "" : ` Manual Mode ${manualModeEnabled ? " Enabled" : "Disabled"}` }
                </button>
            ) }
            <button className="btn btn-transparent" onClick={ onSettingsClick }>
                <Settings size={ 16 } />
                { laptopSize ? "" : " Settings" }
            </button>
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
                    onClick={ onShowBotHandClick }
                >
                    { botHandRevealed ? <Eye size={ 16 } /> : <EyeOff size={ 16 } /> }
                    { laptopSize ? "" : ` Bot Hand ${botHandRevealed ? "Shown" : "Hidden"}` }
                </button>
            ) }
            { showBotHandButton && (
                <button className="btn btn-transparent" onClick={ onCaptureStateClick }>
                    <Camera size={ 16 } />
                    { laptopSize ? "" : " Capture State" }
                </button>
            ) }
            { showDownloadLog && (
                <button className="btn btn-transparent" onClick={ onDownloadLogClick }>
                    <Download size={ 16 } />
                    { laptopSize ? "" : " Game Log" }
                </button>
            ) }
        </div>
    );
}

Controls.displayName = "Controls";

export default Controls;
