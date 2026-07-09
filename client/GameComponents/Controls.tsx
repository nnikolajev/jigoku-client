import { Menu, AlertCircle, Wrench, Settings, Download, Eye, EyeOff, Camera } from "lucide-react";

interface ControlsProps {
    manualModeEnabled?: boolean;
    onDownloadLogClick?: () => void;
    onManualModeClick?: () => void;
    onSettingsClick?: () => void;
    onToggleChatClick?: () => void;
    onShowBotHandClick?: () => void;
    onCaptureStateClick?: () => void;
    showChatAlert?: boolean;
    showDownloadLog?: boolean;
    showManualMode?: boolean;
    showBotHandButton?: boolean;
    botHandRevealed?: boolean;
}

function Controls({
    manualModeEnabled,
    onDownloadLogClick,
    onManualModeClick,
    onSettingsClick,
    onToggleChatClick,
    onShowBotHandClick,
    onCaptureStateClick,
    showChatAlert,
    showDownloadLog,
    showManualMode,
    showBotHandButton,
    botHandRevealed
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
