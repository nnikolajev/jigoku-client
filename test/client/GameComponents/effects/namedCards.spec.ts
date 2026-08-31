import { describe, expect, it } from "vitest";

import { resolveNamedCard, resolveNamedCards } from "../../../../client/GameComponents/effects/namedCards.js";

const cardDatabase = {
    "fine-katana": {
        id: "fine-katana",
        name: "Fine Katana",
        versions: [{ pack_id: "core" }, { pack_id: "emerald-core-set" }]
    },
    "assassination": { id: "assassination", name: "Assassination", versions: [{ pack_id: "core" }] }
};

describe("resolveNamedCard", () => {
    // The engine names the copy actually in this game, so its printing beats a guess
    // from the database.
    it("keeps the printing the server resolved", () => {
        const resolved = resolveNamedCard(
            { name: "Fine Katana", id: "fine-katana", packId: "emerald-core-set" },
            cardDatabase
        );
        expect(resolved.id).toBe("fine-katana");
        expect(resolved.packId).toBe("emerald-core-set");
    });

    // Naming is by name, so a card nobody brought resolves to nothing server-side.
    it("falls back to the card database when nobody brought a copy", () => {
        const resolved = resolveNamedCard({ name: "Fine Katana" }, cardDatabase);
        expect(resolved.id).toBe("fine-katana");
        expect(resolved.packId).toBe("core");
    });

    it("leaves an unknown name unresolved rather than guessing", () => {
        const resolved = resolveNamedCard({ name: "Not A Card" }, cardDatabase);
        expect(resolved.name).toBe("Not A Card");
        expect(resolved.id).toBeUndefined();
    });

    it("survives the card database not having arrived yet", () => {
        expect(resolveNamedCard({ name: "Fine Katana" }, undefined).id).toBeUndefined();
    });

    it("carries the naming card through", () => {
        const resolved = resolveNamedCard(
            { name: "Fine Katana", sourceUuid: "u-sk", sourceName: "Shiro Kitsuki" },
            cardDatabase
        );
        expect(resolved.sourceUuid).toBe("u-sk");
        expect(resolved.sourceName).toBe("Shiro Kitsuki");
    });
});

describe("resolveNamedCards", () => {
    it("returns an empty list for nothing named", () => {
        expect(resolveNamedCards(undefined, cardDatabase)).toEqual([]);
        expect(resolveNamedCards([], cardDatabase)).toEqual([]);
    });

    it("resolves every entry", () => {
        const resolved = resolveNamedCards(
            [{ name: "Fine Katana" }, { name: "Assassination" }],
            cardDatabase
        );
        expect(resolved.map(card => card.id)).toEqual(["fine-katana", "assassination"]);
    });
});
