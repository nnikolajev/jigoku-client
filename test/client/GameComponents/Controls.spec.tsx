import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import Controls from "../../../client/GameComponents/Controls.jsx";

// The bar collapses to a single handle and remembers that across games, so every test
// starts from a known state rather than from whatever the last one left behind.
function setCollapsed(collapsed: boolean) {
    window.localStorage.setItem("jigoku.controlsExpanded", String(!collapsed));
}

describe("the <Controls /> component", () => {
    let onSettingsClick;
    let onManualModeClick;
    let onToggleChatClick;
    let onHistoryClick;
    let onTestAnimationClick;
    let onToggleWinEffectsClick;

    beforeEach(() => {
        onSettingsClick = vi.fn();
        onManualModeClick = vi.fn();
        onToggleChatClick = vi.fn();
        onHistoryClick = vi.fn();
        onTestAnimationClick = vi.fn();
        onToggleWinEffectsClick = vi.fn();
        setCollapsed(false);
    });

    afterEach(() => {
        window.localStorage.clear();
    });

    function renderControls(props = {}) {
        return render(
            <Controls
                onSettingsClick={ onSettingsClick }
                onManualModeClick={ onManualModeClick }
                onToggleChatClick={ onToggleChatClick }
                onHistoryClick={ onHistoryClick }
                showChatAlert={ false }
                manualModeEnabled={ false }
                showManualMode={ false }
                { ...props }
            />
        );
    }

    describe("when rendered with default props", () => {
        it("renders the chat, settings and history buttons", () => {
            renderControls();
            expect(screen.getByRole("button", { name: "Toggle chat" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
        });

        it("does not render the manual mode button when showManualMode is false", () => {
            renderControls();
            expect(screen.queryByRole("button", { name: "Manual mode" })).not.toBeInTheDocument();
        });
    });

    describe("when showManualMode is true", () => {
        it("renders the manual mode button", () => {
            renderControls({ showManualMode: true });
            expect(screen.getByRole("button", { name: "Manual mode" })).toBeInTheDocument();
        });

        it("shows the \"auto\" state when manual mode is disabled", () => {
            renderControls({ showManualMode: true });
            const button = screen.getByRole("button", { name: "Manual mode" });
            expect(button.className).toContain("auto");
            expect(button).toHaveAttribute("aria-pressed", "false");
        });

        it("shows the \"manual\" state when manual mode is enabled", () => {
            renderControls({ showManualMode: true, manualModeEnabled: true });
            const button = screen.getByRole("button", { name: "Manual mode" });
            expect(button.className).toContain("manual");
            expect(button).toHaveAttribute("aria-pressed", "true");
        });
    });

    describe("when showChatAlert is true", () => {
        it("marks the chat button", () => {
            renderControls({ showChatAlert: true });
            expect(screen.getByRole("button", { name: "Toggle chat" }).className).toContain("with-alert");
        });
    });

    describe("when buttons are clicked", () => {
        it("invokes each callback", () => {
            renderControls({ showManualMode: true });
            fireEvent.click(screen.getByRole("button", { name: "Toggle chat" }));
            expect(onToggleChatClick).toHaveBeenCalled();

            fireEvent.click(screen.getByRole("button", { name: "Manual mode" }));
            expect(onManualModeClick).toHaveBeenCalled();

            fireEvent.click(screen.getByRole("button", { name: "Settings" }));
            expect(onSettingsClick).toHaveBeenCalled();

            fireEvent.click(screen.getByRole("button", { name: "History" }));
            expect(onHistoryClick).toHaveBeenCalled();
        });
    });

    describe("the collapse handle", () => {
        it("ships collapsed with only the handle usable", () => {
            window.localStorage.clear();
            const { container } = renderControls();
            expect(container.querySelector(".controls")).toHaveClass("controls--collapsed");
            // The buttons stay mounted so the bar can slide, but must be out of the tab
            // order while hidden.
            expect(container.querySelector(".controls__items")).toHaveAttribute("inert");
            expect(screen.getByRole("button", { name: "Show game controls" })).toBeInTheDocument();
        });

        it("expands and collapses on click", () => {
            window.localStorage.clear();
            const { container } = renderControls();

            fireEvent.click(screen.getByRole("button", { name: "Show game controls" }));
            expect(container.querySelector(".controls")).not.toHaveClass("controls--collapsed");
            expect(container.querySelector(".controls__items")).not.toHaveAttribute("inert");

            fireEvent.click(screen.getByRole("button", { name: "Hide game controls" }));
            expect(container.querySelector(".controls")).toHaveClass("controls--collapsed");
        });

        it("remembers the expanded state across games", () => {
            window.localStorage.clear();
            const first = renderControls();
            fireEvent.click(screen.getByRole("button", { name: "Show game controls" }));
            first.unmount();

            const { container } = renderControls();
            expect(container.querySelector(".controls")).not.toHaveClass("controls--collapsed");
        });
    });

    describe("when animation testing is enabled", () => {
        it("renders one cycling animation button and invokes its callback", () => {
            renderControls({
                onTestAnimationClick,
                showAnimationTest: true,
                animationTestVariant: "military"
            });

            const button = screen.getByRole("button", { name: "Test military win animation" });
            fireEvent.click(button);
            expect(onTestAnimationClick).toHaveBeenCalledOnce();
        });
    });

    describe("when the win-effects toggle is shown", () => {
        it("shows the enabled state and invokes its callback", () => {
            renderControls({ onToggleWinEffectsClick, showWinEffectsToggle: true, winEffectsEnabled: true });

            const button = screen.getByRole("button", { name: "Conflict win effects" });
            expect(button).toHaveAttribute("aria-pressed", "true");
            expect(button).toHaveAttribute("title", "Turn conflict win effects off");
            fireEvent.click(button);
            expect(onToggleWinEffectsClick).toHaveBeenCalledOnce();
        });

        it("shows the disabled state", () => {
            renderControls({ onToggleWinEffectsClick, showWinEffectsToggle: true, winEffectsEnabled: false });

            const button = screen.getByRole("button", { name: "Conflict win effects" });
            expect(button).toHaveAttribute("aria-pressed", "false");
            expect(button).toHaveAttribute("title", "Turn conflict win effects on");
        });
    });
});
