import { describe, expect, it } from "vitest";

import { getGameNodeUrl } from "../../client/gameNodeUrl";

describe("getGameNodeUrl", () => {
    it("uses the lobby origin for a proxied game node", () => {
        expect(getGameNodeUrl({
            address: "100.119.223.35",
            port: 9500,
            protocol: "http",
            proxyThroughLobby: true
        }, "http://lobby.local:4000")).toBe("http://lobby.local:4000");
    });

    it("keeps the advertised address for a separate game node", () => {
        expect(getGameNodeUrl({
            address: "node.example.com",
            port: 443,
            protocol: "https",
            proxyThroughLobby: false
        }, "https://lobby.example.com")).toBe("https://node.example.com");
    });
});
