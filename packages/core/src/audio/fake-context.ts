/**
 * A hand-written stand-in for AudioContext used by tests. It records the nodes
 * that were created so we can assert on routing and scheduling without a real
 * Web Audio implementation.
 */
export interface FakeParam {
  value: number;
  calls: string[];
}

export interface FakeOscillator {
  type: string;
  frequency: FakeParam;
  detune: FakeParam;
  started: boolean;
  /** Context time the voice was scheduled to begin. */
  startedAt: number;
  stopped: boolean;
  connectedTo: unknown[];
}

export interface FakeGain {
  gain: FakeParam;
  connectedTo: unknown[];
}

export interface FakeContext {
  currentTime: number;
  state: string;
  destination: unknown;
  createdOscillators: FakeOscillator[];
  createdGains: FakeGain[];
  createdFilters: unknown[];
  createdBufferSources: unknown[];
  createOscillator(): unknown;
  createGain(): unknown;
  createBiquadFilter(): unknown;
  createBuffer(channels: number, length: number, sampleRate: number): unknown;
  createBufferSource(): unknown;
  resume(): Promise<void>;
  close(): Promise<void>;
  sampleRate: number;
}

const param = (initial: number): FakeParam => {
  const calls: string[] = [];
  const node = {
    value: initial,
    calls,
    setValueAtTime(value: number) {
      node.value = value;
      calls.push('setValueAtTime');
      return node;
    },
    linearRampToValueAtTime(value: number) {
      node.value = value;
      calls.push('linearRampToValueAtTime');
      return node;
    },
    exponentialRampToValueAtTime(value: number) {
      node.value = value;
      calls.push('exponentialRampToValueAtTime');
      return node;
    },
    cancelScheduledValues() {
      calls.push('cancelScheduledValues');
      return node;
    },
  };
  return node as unknown as FakeParam;
};

export function fakeContext(): FakeContext {
  const context: FakeContext = {
    currentTime: 0,
    state: 'suspended',
    sampleRate: 44100,
    destination: { name: 'destination' },
    createdOscillators: [],
    createdGains: [],
    createdFilters: [],
    createdBufferSources: [],
    createOscillator() {
      const node = {
        type: 'sine',
        frequency: param(440),
        detune: param(0),
        started: false,
        startedAt: 0,
        stopped: false,
        connectedTo: [] as unknown[],
        connect(target: unknown) {
          node.connectedTo.push(target);
          return target;
        },
        disconnect() {},
        start(when = 0) {
          node.started = true;
          node.startedAt = when;
        },
        stop() {
          node.stopped = true;
        },
        onended: null,
      };
      context.createdOscillators.push(node as unknown as FakeOscillator);
      return node;
    },
    createGain() {
      const node = {
        gain: param(1),
        connectedTo: [] as unknown[],
        connect(target: unknown) {
          node.connectedTo.push(target);
          return target;
        },
        disconnect() {},
      };
      context.createdGains.push(node as unknown as FakeGain);
      return node;
    },
    createBiquadFilter() {
      const node = {
        type: 'lowpass',
        frequency: param(1000),
        Q: param(1),
        connect: (target: unknown) => target,
        disconnect() {},
      };
      context.createdFilters.push(node);
      return node;
    },
    createBuffer(channels: number, length: number) {
      const data = new Float32Array(length);
      return { getChannelData: () => data, length, numberOfChannels: channels };
    },
    createBufferSource() {
      const node = {
        buffer: null as unknown,
        started: false,
        stopped: false,
        connect: (target: unknown) => target,
        disconnect() {},
        start() {
          node.started = true;
        },
        stop() {
          node.stopped = true;
        },
        onended: null,
      };
      context.createdBufferSources.push(node);
      return node;
    },
    async resume() {
      context.state = 'running';
    },
    async close() {
      context.state = 'closed';
    },
  };
  return context;
}
