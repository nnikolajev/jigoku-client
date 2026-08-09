import { describe, expect, it } from "vitest";

import { buildGameNodeHandoff } from "../../server/gameNodeHandoff";

describe("buildGameNodeHandoff", () => {
    it("tells clients when a co-hosted node is proxied through the lobby", () => {
        expect(buildGameNodeHandoff({
            address: "100.119.223.35",
            port: 9500,
            protocol: "http",
            identity: "pi"
        }, "http://game-node:9500", "game-1")).toEqual({
            address: "100.119.223.35",
            port: 9500,
            protocol: "http",
            name: "pi",
            proxyThroughLobby: true,
            gameId: "game-1"
        });
    });

    it("keeps direct handoff when no proxy is configured", () => {
        expect(buildGameNodeHandoff({
            address: "node.example.com",
            port: 9500,
            protocol: "http",
            identity: "node"
        }, undefined).proxyThroughLobby).toBe(false);
    });
});
