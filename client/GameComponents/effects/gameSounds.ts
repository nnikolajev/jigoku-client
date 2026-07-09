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
