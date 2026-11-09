import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installTouchGestures } from "../../../client/GameComponents/touchGestures.js";

interface Point {
    x: number;
    y: number;
}

function fireTouch(type: string, point: Point, time: number): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    const list = type === "touchend" ? [] : [{ clientX: point.x, clientY: point.y }];
    Object.defineProperty(event, "touches", { value: list });
    Object.defineProperty(event, "changedTouches", { value: [{ clientX: point.x, clientY: point.y }] });
    Object.defineProperty(event, "timeStamp", { value: time });
    document.dispatchEvent(event);
    return event;
}

describe("touchGestures", () => {
    let uninstall: () => void;
    let log: string[];
    let cardA: HTMLElement;
    let cardB: HTMLElement;

    beforeEach(() => {
        document.body.innerHTML = "<div class=\"game-board\"><div class=\"card\" id=\"a\"></div><div class=\"card\" id=\"b\"></div></div>";
        cardA = document.getElementById("a") ?? document.body;
        cardB = document.getElementById("b") ?? document.body;
        log = [];
        for(const card of [cardA, cardB]) {
            for(const type of ["mouseover", "mouseout", "click"]) {
                card.addEventListener(type, () => log.push(`${type}:${card.id}`));
            }
        }
        // jsdom has no layout: card A covers x < 100, card B the rest.
        document.elementFromPoint = (x: number) => (x < 100 ? cardA : cardB);
        uninstall = installTouchGestures(document);
    });

    afterEach(() => uninstall());

    it("zooms on touch and clicks on a quick still tap", () => {
        const start = fireTouch("touchstart", { x: 10, y: 10 }, 0);
        fireTouch("touchend", { x: 10, y: 10 }, 100);
        expect(start.defaultPrevented).toBe(true);
        expect(log).toEqual(["mouseover:a", "click:a", "mouseout:a"]);
    });

    it("scrubs the zoom across cards without clicking", () => {
        fireTouch("touchstart", { x: 10, y: 10 }, 0);
        const move = fireTouch("touchmove", { x: 600, y: 10 }, 50);
        fireTouch("touchend", { x: 600, y: 10 }, 100);
        expect(move.defaultPrevented).toBe(true);
        expect(log).toEqual(["mouseover:a", "mouseout:a", "mouseover:b", "mouseout:b"]);
        expect(document.documentElement.dataset.touchSide).toBe("right");
    });

    it("treats a still hold as a look, not a click", () => {
        fireTouch("touchstart", { x: 10, y: 10 }, 0);
        fireTouch("touchend", { x: 10, y: 10 }, 400);
        expect(log).toEqual(["mouseover:a", "mouseout:a"]);
    });

    it("ignores touches that do not start on a card", () => {
        document.elementFromPoint = () => document.body;
        const start = fireTouch("touchstart", { x: 10, y: 10 }, 0);
        fireTouch("touchend", { x: 10, y: 10 }, 50);
        expect(start.defaultPrevented).toBe(false);
        expect(log).toEqual([]);
    });
});
