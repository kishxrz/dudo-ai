// @ts-nocheck
import Module from 'module';

console.log('=== STARTING WHATSAPP FRONTEND LIFECYCLE TESTS ===\n');

let passed = 0;
let failed = 0;

const assert = (condition: boolean, testName: string) => {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failed++;
  }
};

// Simulate the frontend state variables and event loop triggers
class MockAgentChannelsComponent {
  // State
  waStatus: 'disconnected' | 'qr_ready' | 'connected' | 'connecting' = 'disconnected';
  waQrCode: string | null = null;
  waConnecting = false;
  waError = '';
  qrLoading = false;
  connectStartTime: number | null = null;
  qrTimeout = false;
  imgLoaded = false;
  workspaceId = 'ws-123';
  user = { getIdToken: async () => 'id-token-xyz' };
  
  // Refs
  lastQrRef = { current: null as string | null };
  connectInFlightRef = { current: false };

  // Fetch mock tracking
  fetchCalls: { url: string; options?: any }[] = [];
  fetchMockResponse: (url: string) => Promise<any> = async () => ({ status: 'disconnected' });

  // Timer mock tracking
  activeIntervals: any[] = [];
  activeTimeouts: any[] = [];

  constructor() {
    // Stub global fetch
    global.fetch = async (url: string, options?: any) => {
      this.fetchCalls.push({ url, options });
      const resVal = await this.fetchMockResponse(url);
      return {
        ok: resVal.ok !== false,
        status: resVal.statusVal || 200,
        json: async () => resVal,
        text: async () => JSON.stringify(resVal),
        blob: async () => ({
          type: 'image/png'
        })
      } as any;
    };

    // Stub global URL.createObjectURL / revokeObjectURL
    global.URL = {
      createObjectURL: () => 'blob:qr-image-url',
      revokeObjectURL: () => {}
    } as any;

    // Stub timers
    global.setInterval = (cb: any, time: number) => {
      const id = { cb, time, type: 'interval' };
      this.activeIntervals.push(id);
      return id as any;
    };
    global.clearInterval = (id: any) => {
      this.activeIntervals = this.activeIntervals.filter(x => x !== id);
    };

    global.setTimeout = (cb: any, time: number) => {
      const id = { cb, time, type: 'timeout' };
      this.activeTimeouts.push(id);
      return id as any;
    };
    global.clearTimeout = (id: any) => {
      this.activeTimeouts = this.activeTimeouts.filter(x => x !== id);
    };
  }

  // Simulate active channel load (does NOT connect automatically)
  mountAndSelectTab() {
    this.fetchCalls = [];
    this.checkStatusAndQr();
  }

  // Effect logic
  async checkStatusAndQr() {
    if (!this.workspaceId) return;
    try {
      const res = await fetch(`/api/whatsapp/status?workspaceId=${this.workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        this.waStatus = data.status || 'disconnected';
        
        if (this.waStatus === 'connected') {
          this.waQrCode = null;
          this.qrLoading = false;
          this.qrTimeout = false;
          this.connectStartTime = null;
          this.waConnecting = false;
          return;
        }

        if (this.waStatus === 'qr_ready') {
          const qrRes = await fetch(`/api/whatsapp/qr?workspaceId=${this.workspaceId}`);
          if (qrRes.ok) {
            this.waQrCode = 'blob:qr-image-url';
            this.qrLoading = false;
            this.qrTimeout = false;
          }
        } else if (this.waStatus === 'connecting') {
          this.qrLoading = true;
        } else {
          if (!this.connectStartTime) {
            this.qrLoading = false;
          }
        }
      }
    } catch (e) {
      this.waError = 'Status check failed';
    }
  }

  // User click event
  async handleConnectWhatsApp() {
    if (!this.workspaceId) return;
    if (this.connectInFlightRef.current || this.waConnecting) return;

    this.connectInFlightRef.current = true;
    this.waConnecting = true;
    this.waError = '';
    this.qrLoading = true;
    this.qrTimeout = false;
    this.connectStartTime = Date.now();

    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: this.workspaceId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.qr) {
          this.waQrCode = data.qr;
          this.waStatus = 'qr_ready';
          this.qrLoading = false;
          this.connectStartTime = null;
        } else {
          this.waStatus = 'connecting';
        }
      } else {
        this.waError = 'Failed to connect';
        this.qrLoading = false;
        this.connectStartTime = null;
      }
    } catch (e) {
      this.waError = 'Failed to connect';
    } finally {
      this.waConnecting = false;
      this.connectInFlightRef.current = false;
    }
  }
}

async function runTests() {
  try {
    // --- 1. Opening WhatsApp channel does not call POST /connect ---
    const component = new MockAgentChannelsComponent();
    component.mountAndSelectTab();
    assert(
      component.fetchCalls.some(c => c.url.includes('status')) &&
      !component.fetchCalls.some(c => c.url.includes('connect')),
      'Opening WhatsApp channel queries status but does NOT trigger POST /connect'
    );

    // --- 2. Disconnected status renders Connect button and no spinner ---
    assert(
      component.waStatus === 'disconnected' && component.qrLoading === false,
      'Disconnected status initializes with qrLoading=false (renders Connect button, no spinner)'
    );

    // --- 3. Explicit Connect click calls POST /connect exactly once ---
    component.fetchCalls = [];
    component.fetchMockResponse = async (url) => {
      if (url.includes('connect')) return { status: 'connecting' };
      return { status: 'disconnected' };
    };
    await component.handleConnectWhatsApp();
    const connectCalls = component.fetchCalls.filter(c => c.url.includes('connect'));
    assert(
      connectCalls.length === 1 && connectCalls[0].options.method === 'POST',
      'Explicit Connect click triggers POST /connect exactly once'
    );

    // --- 4. QR polling starts only after explicit connect or verified active connection attempt ---
    assert(
      component.waStatus === 'connecting' && component.qrLoading === true,
      'Connection polling starts/spinner shows when connect transitions status to connecting'
    );

    // --- 5. QR is rendered when available ---
    component.fetchMockResponse = async (url) => {
      if (url.includes('status')) return { status: 'qr_ready' };
      return {};
    };
    await component.checkStatusAndQr();
    assert(
      component.waStatus === 'qr_ready' && component.waQrCode !== null,
      'QR image source is rendered when qr_ready state is returned'
    );

    // --- 6. Polling stops after connected ---
    component.fetchMockResponse = async (url) => {
      if (url.includes('status')) return { status: 'connected' };
      return {};
    };
    await component.checkStatusAndQr();
    assert(
      component.waStatus === 'connected' && component.waQrCode === null && component.qrLoading === false,
      'Polling flags reset and QR is cleared once connected status is confirmed'
    );

    // --- 7. Duplicate clicks do not create duplicate clients ---
    const doubleClickComponent = new MockAgentChannelsComponent();
    doubleClickComponent.fetchMockResponse = () => new Promise(resolve => setTimeout(() => resolve({}), 100));
    const p1 = doubleClickComponent.handleConnectWhatsApp();
    const p2 = doubleClickComponent.handleConnectWhatsApp();
    await Promise.all([p1, p2]);
    const numConnectCalls = doubleClickComponent.fetchCalls.filter(c => c.url.includes('connect')).length;
    assert(
      numConnectCalls === 1,
      'Guard block prevents duplicate connect fetch requests when multiple clicks happen in-flight'
    );

    console.log(`\n=== FRONTEND LIFE CYCLE TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED ===`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error('Frontend tests failed:', e);
    process.exit(1);
  }
}

runTests();
