// Touch gestures for tablets, on any card inside the game board.
//
//   finger lands     -> zoom that card at once (hover)
//   finger slides    -> zoom follows the card under the finger (scrub); no action
//   quick still tap  -> click
//   hold still, lift -> look only; no action
//   hold still, move -> drag the card; release over a pile/zone drops it
//   finger lifts     -> zoom clears, as when a mouse leaves the card, so it
//                       never sits over the board
//
// Hover and click reuse the existing React handlers by dispatching
// mouseover/mouseout/click on the card element. Drag reuses the existing
// HTML5 drop zones by dispatching dragstart on the card and drop on the
// element under the finger with one shared DataTransfer, so every onDrop
// that reads dataTransfer.getData("Text") works unchanged.

export const TAP_MAX_MS = 300;
export const TAP_SLOP_PX = 10;
export const DRAG_HOLD_MS = 450;

const CARD_SELECTOR = ".game-board .card";
const ARMED_CLASS = "touch-drag-armed";
const GHOST_CLASS = "touch-drag-ghost";

function cardAt(x: number, y: number): Element | null {
    const element = document.elementFromPoint(x, y);
    return element ? element.closest(CARD_SELECTOR) : null;
}

function newDataTransfer(): DataTransfer | null {
    try {
        return new DataTransfer();
    } catch{
        return null;
    }
}

function fireDrag(element: Element, type: string, dataTransfer: DataTransfer) {
    element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
}

export function installTouchGestures(target: Document): () => void {
    let hovered: Element | null = null;
    let startCard: Element | null = null;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let moved = false;
    let armed = false;
    let holdTimer = 0;
    let dataTransfer: DataTransfer | null = null;
    let ghost: HTMLElement | null = null;
    let ghostOffsetX = 0;
    let ghostOffsetY = 0;

    const hover = (next: Element, x: number) => {
        // Tells the CSS which half the finger is on, so the zoom opens on the other.
        document.documentElement.dataset.touchSide = x > window.innerWidth / 2 ? "right" : "left";
        if(next === hovered) {
            return;
        }
        if(hovered && hovered.isConnected) {
            hovered.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: next }));
        }
        next.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: hovered }));
        hovered = next;
    };

    const unhover = () => {
        if(hovered && hovered.isConnected) {
            hovered.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
        }
        hovered = null;
    };

    const reset = () => {
        window.clearTimeout(holdTimer);
        startCard?.classList.remove(ARMED_CLASS);
        ghost?.remove();
        ghost = null;
        dataTransfer = null;
        startCard = null;
        armed = false;
    };

    const startDrag = (card: Element, x: number, y: number) => {
        dataTransfer = newDataTransfer();
        if(!dataTransfer) {
            return;
        }
        fireDrag(card, "dragstart", dataTransfer);
        const rect = card.getBoundingClientRect();
        ghostOffsetX = x - rect.left;
        ghostOffsetY = y - rect.top;
        const clone = card.cloneNode(true);
        if(!(clone instanceof HTMLElement)) {
            return;
        }
        clone.classList.remove(ARMED_CLASS);
        clone.classList.add(GHOST_CLASS);
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        document.body.appendChild(clone);
        ghost = clone;
    };

    const moveGhost = (x: number, y: number) => {
        if(ghost) {
            ghost.style.transform = `translate(${x - ghostOffsetX}px, ${y - ghostOffsetY}px)`;
        }
    };

    const onStart = (event: TouchEvent) => {
        reset();
        if(event.touches.length !== 1) {
            return;
        }
        const touch = event.touches[0];
        const card = cardAt(touch.clientX, touch.clientY);
        if(!card) {
            return;
        }
        // Take the whole gesture: no emulated mouse events, no native
        // long-press drag, callout or text selection on the card.
        event.preventDefault();
        startCard = card;
        startX = touch.clientX;
        startY = touch.clientY;
        startTime = event.timeStamp;
        moved = false;
        hover(card, touch.clientX);
        holdTimer = window.setTimeout(() => {
            if(startCard === card && !moved) {
                armed = true;
                card.classList.add(ARMED_CLASS);
            }
        }, DRAG_HOLD_MS);
    };

    const onMove = (event: TouchEvent) => {
        if(!startCard) {
            return;
        }
        // Prevent from the first move: once the browser starts scrolling the
        // event is no longer cancelable.
        event.preventDefault();
        const touch = event.touches[0];
        if(!moved && Math.hypot(touch.clientX - startX, touch.clientY - startY) < TAP_SLOP_PX) {
            return;
        }
        if(!moved) {
            moved = true;
            window.clearTimeout(holdTimer);
            if(armed) {
                startDrag(startCard, touch.clientX, touch.clientY);
            }
        }
        if(armed) {
            moveGhost(touch.clientX, touch.clientY);
            return;
        }
        // A gap between cards keeps the last zoom instead of flickering it off.
        const card = cardAt(touch.clientX, touch.clientY);
        if(card) {
            hover(card, touch.clientX);
        }
    };

    const onEnd = (event: TouchEvent) => {
        const card = startCard;
        if(!card) {
            return;
        }
        event.preventDefault();
        const touch = event.changedTouches[0];
        if(dataTransfer && touch) {
            const drop = document.elementFromPoint(touch.clientX, touch.clientY);
            const transfer = dataTransfer;
            reset();
            if(drop) {
                fireDrag(drop, "drop", transfer);
            }
            fireDrag(card, "dragend", transfer);
            unhover();
            return;
        }
        const tap = !moved && !armed && event.timeStamp - startTime < TAP_MAX_MS;
        reset();
        if(tap && card.isConnected) {
            card.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        }
        unhover();
    };

    const onCancel = () => {
        reset();
        unhover();
    };

    const options = { passive: false };
    target.addEventListener("touchstart", onStart, options);
    target.addEventListener("touchmove", onMove, options);
    target.addEventListener("touchend", onEnd, options);
    target.addEventListener("touchcancel", onCancel);

    return () => {
        reset();
        target.removeEventListener("touchstart", onStart);
        target.removeEventListener("touchmove", onMove);
        target.removeEventListener("touchend", onEnd);
        target.removeEventListener("touchcancel", onCancel);
    };
}
