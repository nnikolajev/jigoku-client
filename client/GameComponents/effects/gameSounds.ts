// Small synthesized sound effects using the Web Audio API so no audio assets are required.
let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
    try {
        if(!audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if(!AudioContextClass) {
                return null;
            }
            audioContext = new AudioContextClass();
        }
        if(audioContext.state === "suspended") {
            audioContext.resume();
        }
        return audioContext;
    } catch{
        return null;
    }
}

function createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
}

// Short "swish" for a card flipping face up.
export function playCardFlip(): void {
    const ctx = getContext();
    if(!ctx) {
        return;
    }
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.2);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(2500, now + 0.12);
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.2);
}

// Soft table "thump" with a paper snap for any player playing a card.
export function playCardPlay(): void {
    const ctx = getContext();
    if(!ctx) {
        return;
    }
    const now = ctx.currentTime;

    // Low felt thump.
    const thump = ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(190, now);
    thump.frequency.exponentialRampToValueAtTime(70, now + 0.12);

    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.25, now + 0.015);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    thump.connect(thumpGain).connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.18);

    // Short bright paper snap on top.
    const snap = ctx.createBufferSource();
    snap.buffer = createNoiseBuffer(ctx, 0.06);

    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = "bandpass";
    snapFilter.frequency.value = 3200;
    snapFilter.Q.value = 0.9;

    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.0001, now);
    snapGain.gain.exponentialRampToValueAtTime(0.12, now + 0.008);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    snap.connect(snapFilter).connect(snapGain).connect(ctx.destination);
    snap.start(now);
    snap.stop(now + 0.06);
}

// Big sword slash for a high-skill military conflict: air whoosh then a metallic ring.
export function playSwordSlash(): void {
    const ctx = getContext();
    if(!ctx) {
        return;
    }
    const now = ctx.currentTime;

    // Air whoosh: highpass noise sweeping upward.
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = createNoiseBuffer(ctx, 0.35);

    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = "bandpass";
    whooshFilter.frequency.setValueAtTime(500, now);
    whooshFilter.frequency.exponentialRampToValueAtTime(4500, now + 0.22);
    whooshFilter.Q.value = 1.6;

    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.0001, now);
    whooshGain.gain.exponentialRampToValueAtTime(0.35, now + 0.06);
    whooshGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    whoosh.connect(whooshFilter).connect(whooshGain).connect(ctx.destination);
    whoosh.start(now);
    whoosh.stop(now + 0.35);

    // Metallic ring: detuned high partials with a long decay, starting at the slash impact.
    const ringStart = now + 0.16;
    for(const [frequency, level] of [[2093, 0.16], [3136, 0.1], [4699, 0.06]] as const) {
        const ring = ctx.createOscillator();
        ring.type = "triangle";
        ring.frequency.setValueAtTime(frequency, ringStart);

        const ringGain = ctx.createGain();
        ringGain.gain.setValueAtTime(0.0001, ringStart);
        ringGain.gain.exponentialRampToValueAtTime(level, ringStart + 0.01);
        ringGain.gain.exponentialRampToValueAtTime(0.0001, ringStart + 0.9);

        ring.connect(ringGain).connect(ctx.destination);
        ring.start(ringStart);
        ring.stop(ringStart + 0.95);
    }
}

// Heavy fist punch for a high-skill political conflict: deep bass drop plus a body thud.
export function playFistPunch(): void {
    const ctx = getContext();
    if(!ctx) {
        return;
    }
    const now = ctx.currentTime;

    // Deep bass drop.
    const bass = ctx.createOscillator();
    bass.type = "sine";
    bass.frequency.setValueAtTime(150, now);
    bass.frequency.exponentialRampToValueAtTime(38, now + 0.28);

    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0.0001, now);
    bassGain.gain.exponentialRampToValueAtTime(0.5, now + 0.02);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    bass.connect(bassGain).connect(ctx.destination);
    bass.start(now);
    bass.stop(now + 0.5);

    // Body thud: short lowpass noise burst.
    const thud = ctx.createBufferSource();
    thud.buffer = createNoiseBuffer(ctx, 0.12);

    const thudFilter = ctx.createBiquadFilter();
    thudFilter.type = "lowpass";
    thudFilter.frequency.setValueAtTime(1200, now);
    thudFilter.frequency.exponentialRampToValueAtTime(200, now + 0.1);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.0001, now);
    thudGain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    thud.connect(thudFilter).connect(thudGain).connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.12);
}

// Burning fire sound for a province being broken: a flame rumble plus random crackle pops.
export function playProvinceBreak(): void {
    const ctx = getContext();
    if(!ctx) {
        return;
    }
    const now = ctx.currentTime;
    const duration = 2;

    // Flame body: lowpass noise with a flickering amplitude.
    const rumble = ctx.createBufferSource();
    rumble.buffer = createNoiseBuffer(ctx, duration);

    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.setValueAtTime(900, now);
    rumbleFilter.frequency.exponentialRampToValueAtTime(350, now + duration - 0.2);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.0001, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.22, now + 0.12);
    // Random flicker steps to make the flame feel alive.
    for(let t = 0.2; t < duration - 0.4; t += 0.12) {
        rumbleGain.gain.linearRampToValueAtTime(0.1 + Math.random() * 0.14, now + t);
    }
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    rumble.connect(rumbleFilter).connect(rumbleGain).connect(ctx.destination);
    rumble.start(now);
    rumble.stop(now + duration);

    // Crackle pops: short bright noise bursts at random times.
    const popCount = 14;
    for(let i = 0; i < popCount; i++) {
        const popTime = now + 0.05 + Math.random() * (duration - 0.5);
        const popLength = 0.02 + Math.random() * 0.04;

        const pop = ctx.createBufferSource();
        pop.buffer = createNoiseBuffer(ctx, popLength);

        const popFilter = ctx.createBiquadFilter();
        popFilter.type = "highpass";
        popFilter.frequency.value = 1500 + Math.random() * 3000;

        const popGain = ctx.createGain();
        popGain.gain.setValueAtTime(0.0001, popTime);
        popGain.gain.exponentialRampToValueAtTime(0.1 + Math.random() * 0.15, popTime + 0.005);
        popGain.gain.exponentialRampToValueAtTime(0.0001, popTime + popLength);

        pop.connect(popFilter).connect(popGain).connect(ctx.destination);
        pop.start(popTime);
        pop.stop(popTime + popLength + 0.01);
    }
}
