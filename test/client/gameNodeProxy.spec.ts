import { describe, expect, it } from "vitest";

import { getGameNodeProxyOrigin, isGameNodeSocketPath } from "../../server/gameNodeProxy";

describe("game node proxy", () => {
    it("matches game Socket.IO polling and WebSocket paths only", () => {
        expect(isGameNodeSocketPath("/pi/socket.io/?EIO=4&transport=polling")).toBe(true);
        expect(isGameNodeSocketPath("/socket.io/?EIO=4&transport=polling")).toBe(false);
        expect(isGameNodeSocketPath("/api/decks")).toBe(false);
    });

    it("uses the public lobby origin for the internal proxy request", () => {
        expect(getGameNodeProxyOrigin({
            domain: "100.119.223.35",
            https: false,
            lobby: { port: 4000 }
        })).toBe("http://100.119.223.35:4000");
    });
});
