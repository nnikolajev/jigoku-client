import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { InnerProfile } from "../../client/Profile.jsx";

function makeUser(visualSuggestions?: boolean) {
    return {
        email: "player@example.com",
        promptedActionWindows: {},
        settings: {
            optionSettings: visualSuggestions === undefined ? {} : { visualSuggestions },
            timerSettings: {}
        },
        username: "TestPlayer"
    };
}

describe("the <Profile /> component", () => {
    it("should enable Visual suggestions by default", () => {
        render(<InnerProfile refreshUser={ vi.fn() } socket={ {} } user={ makeUser() } />);

        expect(screen.getByRole("checkbox", { name: "Visual suggestions" })).toBeChecked();
    });

    it("should show Visual suggestions as disabled when configured off", () => {
        render(<InnerProfile refreshUser={ vi.fn() } socket={ {} } user={ makeUser(false) } />);

        expect(screen.getByRole("checkbox", { name: "Visual suggestions" })).not.toBeChecked();
    });
});
