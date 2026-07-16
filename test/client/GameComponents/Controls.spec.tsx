import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import Controls from "../../../client/GameComponents/Controls.jsx";

describe("the <Controls /> component", () => {
    let onSettingsClick;
    let onManualModeClick;
    let onToggleChatClick;
    let onTestAnimationClick;
    let onToggleWinEffectsClick;

    beforeEach(() => {
        onSettingsClick = vi.fn();
        onManualModeClick = vi.fn();
        onToggleChatClick = vi.fn();
        onTestAnimationClick = vi.fn();
        onToggleWinEffectsClick = vi.fn();
    });

    describe("when rendered with default props", () => {
        beforeEach(() => {
            render(
                <Controls
                    onSettingsClick={ onSettingsClick }
                    onManualModeClick={ onManualModeClick }
                    onToggleChatClick={ onToggleChatClick }
                    showChatAlert={ false }
                    manualModeEnabled={ false }
                    showManualMode={ false }
                />
            );
        });

        it("should render the toggle chat button", () => {
            const buttons = screen.getAllByRole("button");
            expect(buttons.length).toBeGreaterThanOrEqual(1);
        });

        it("should render the settings button", () => {
            const buttons = screen.getAllByRole("button");
            expect(buttons.length).toBeGreaterThanOrEqual(2);
        });

        it("should not render the manual mode button when showManualMode is false", () => {
            const buttons = screen.getAllByRole("button");
            // Only 2 buttons: toggle chat and settings
            expect(buttons.length).toBe(2);
        });
    });

    describe("when showManualMode is true", () => {
        beforeEach(() => {
            render(
                <Controls
                    onSettingsClick={ onSettingsClick }
                    onManualModeClick={ onManualModeClick }
                    onToggleChatClick={ onToggleChatClick }
                    showChatAlert={ false }
                    manualModeEnabled={ false }
                    showManualMode
                />
            );
        });

        it("should render the manual mode button", () => {
            const buttons = screen.getAllByRole("button");
            // 3 buttons: toggle chat, manual mode, settings
            expect(buttons.length).toBe(3);
        });

        it("should have \"auto\" class when manual mode is disabled", () => {
            const buttons = screen.getAllByRole("button");
            // The manual mode button is the second one (index 1)
            expect(buttons[1].className).toContain("auto");
        });
    });

    describe("when manualModeEnabled is true", () => {
        beforeEach(() => {
            render(
                <Controls
                    onSettingsClick={ onSettingsClick }
                    onManualModeClick={ onManualModeClick }
                    onToggleChatClick={ onToggleChatClick }
                    showChatAlert={ false }
                    manualModeEnabled
                    showManualMode
                />
            );
        });

        it("should have \"manual\" class when manual mode is enabled", () => {
            const buttons = screen.getAllByRole("button");
            // The manual mode button is the second one (index 1)
            expect(buttons[1].className).toContain("manual");
        });
    });

    describe("when showChatAlert is true", () => {
        beforeEach(() => {
            render(
                <Controls
                    onSettingsClick={ onSettingsClick }
                    onManualModeClick={ onManualModeClick }
                    onToggleChatClick={ onToggleChatClick }
                    showChatAlert
                    manualModeEnabled={ false }
                    showManualMode={ false }
                />
            );
        });

        it("should have \"with-alert\" class on the toggle chat button", () => {
            const buttons = screen.getAllByRole("button");
            expect(buttons[0].className).toContain("with-alert");
        });
    });

    describe("when buttons are clicked", () => {
        beforeEach(() => {
            render(
                <Controls
                    onSettingsClick={ onSettingsClick }
                    onManualModeClick={ onManualModeClick }
                    onToggleChatClick={ onToggleChatClick }
                    showChatAlert={ false }
                    manualModeEnabled={ false }
                    showManualMode
                />
            );
        });

        it("should call onToggleChatClick when toggle chat button is clicked", () => {
            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[0]);
            expect(onToggleChatClick).toHaveBeenCalled();
        });

        it("should call onManualModeClick when manual mode button is clicked", () => {
            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[1]);
            expect(onManualModeClick).toHaveBeenCalled();
        });

        it("should call onSettingsClick when settings button is clicked", () => {
            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[2]);
            expect(onSettingsClick).toHaveBeenCalled();
        });
    });

    describe("when animation testing is enabled", () => {
        it("renders one cycling animation button and invokes its callback", () => {
            render(
                <Controls
                    onSettingsClick={ onSettingsClick }
                    onToggleChatClick={ onToggleChatClick }
                    onTestAnimationClick={ onTestAnimationClick }
                    showAnimationTest
                    animationTestVariant="military"
                />
            );

            const button = screen.getByRole("button", { name: "Test military win animation" });
            fireEvent.click(button);
            expect(onTestAnimationClick).toHaveBeenCalledOnce();
        });
    });

    describe("when the win-effects toggle is shown", () => {
        it("shows the enabled state and invokes its callback", () => {
            render(
                <Controls
                    onSettingsClick={ onSettingsClick }
                    onToggleChatClick={ onToggleChatClick }
                    onToggleWinEffectsClick={ onToggleWinEffectsClick }
                    showWinEffectsToggle
                    winEffectsEnabled
                />
            );

            const button = screen.getByRole("button", { name: "Conflict win effects" });
            expect(button).toHaveAttribute("aria-pressed", "true");
            expect(button).toHaveAttribute("title", "Turn conflict win effects off");
            fireEvent.click(button);
            expect(onToggleWinEffectsClick).toHaveBeenCalledOnce();
        });

        it("shows the disabled state", () => {
            render(
                <Controls
                    onSettingsClick={ onSettingsClick }
                    onToggleChatClick={ onToggleChatClick }
                    onToggleWinEffectsClick={ onToggleWinEffectsClick }
                    showWinEffectsToggle
                    winEffectsEnabled={ false }
                />
            );

            const button = screen.getByRole("button", { name: "Conflict win effects" });
            expect(button).toHaveAttribute("aria-pressed", "false");
            expect(button).toHaveAttribute("title", "Turn conflict win effects on");
        });
    });
});
