// peer.js — serverless WebRTC transport for a user-initiated live session.
// No Hookline server, no signaling server, no TURN relay. STUN is used only
// so each side can discover its own reachable address — a STUN server sees
// an IP, never the data channel, never your script. The SDP offer/answer is
// still handed peer-to-peer by the user out of band (copy/paste). This
// module is pure transport + a Lamport clock: NO DOM, NO storage. The
// script-merge logic lives in app.js, which owns the document state.

const TOKEN_PREFIX = 'HKL1:';

// Compact a session description into one copy-pasteable token.
function pack(desc) {
  return TOKEN_PREFIX + btoa(unescape(encodeURIComponent(
    JSON.stringify({ t: desc.type, s: desc.sdp }))));
}
function unpack(token) {
  const raw = String(token || '').trim();
  if (!raw.startsWith(TOKEN_PREFIX)) throw new Error('Not a Hookline session code.');
  const o = JSON.parse(decodeURIComponent(escape(atob(raw.slice(TOKEN_PREFIX.length)))));
  return { type: o.t, sdp: o.s };
}

// Non-trickle ICE: there is no signaling channel to trickle candidates over,
// so wait until gathering completes and emit one self-contained SDP. A short
// fallback timeout covers browsers that never fire 'complete'.
// Wait for ICE gathering to COMPLETE before serializing the SDP. With no
// signaling channel we cannot trickle candidates, so they must already be
// folded into localDescription. Do not settle early on the first candidate:
// STUN srflx candidates arrive later than host ones, and packing before they
// land is the classic "connects to nothing, no error". Match the proven
// reference: resolve on 'complete', or an 8s safety valve so it never hangs.
function gathered(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(t); resolve(); };
    const t = setTimeout(finish, 8000);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') finish();
    });
  });
}

// handlers: { onstate, onmessage, ontrack, onscreenend }
export function createPeer(handlers = {}) {
  const h = handlers;
  // Random per-peer id: also the deterministic tiebreaker for last-write-wins.
  const peerId = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).slice(0, 8);

  // STUN only — discovers each peer's reachable address. No TURN: no relay
  // server, so traffic stays peer-to-peer (fails only behind strict
  // symmetric NATs, e.g. some corporate/mobile networks).
  const pc = new RTCPeerConnection({ iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ] });
  let chan = null;
  let screenSender = null;
  let role = null; // 'host' | 'guest'
  let iceCount = 0;
  // Authoritative: count the candidates actually in the final SDP. Zero
  // means the browser exposed no usable address at all (rare with STUN) —
  // the UI surfaces it instead of failing mutely.
  const countIce = () => {
    const sdp = (pc.localDescription && pc.localDescription.sdp) || '';
    iceCount = (sdp.match(/^a=candidate:/gm) || []).length;
  };

  const setState = (s) => { if (h.onstate) h.onstate(s); };

  pc.addEventListener('connectionstatechange', () => setState(pc.connectionState));
  pc.addEventListener('track', (e) => { if (h.ontrack) h.ontrack(e.streams[0] || new MediaStream([e.track])); });

  function wireChannel(c) {
    chan = c;
    c.addEventListener('open', () => setState('connected'));
    c.addEventListener('close', () => setState('closed'));
    c.addEventListener('message', (e) => {
      let msg; try { msg = JSON.parse(e.data); } catch (_) { return; }
      if (h.onmessage) h.onmessage(msg);
    });
  }

  return {
    peerId,
    get role() { return role; },
    get connected() { return !!chan && chan.readyState === 'open'; },
    // How many ICE candidates the session code carries. Zero means the
    // browser exposed no shareable address (mDNS-masked / blocked) and the
    // code cannot connect — the UI surfaces this instead of failing mutely.
    get iceCount() { return iceCount; },

    // Host: create the offer token to send to the other person.
    async createOffer() {
      role = 'host';
      wireChannel(pc.createDataChannel('hookline', { ordered: true }));
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      countIce();
      return pack(pc.localDescription);
    },

    // Guest: consume the offer token, return an answer token to send back.
    async acceptOffer(offerToken) {
      role = 'guest';
      pc.addEventListener('datachannel', (e) => wireChannel(e.channel));
      await pc.setRemoteDescription(unpack(offerToken));
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      countIce();
      return pack(pc.localDescription);
    },

    // Host: finish the handshake with the guest's answer token.
    async acceptAnswer(answerToken) {
      await pc.setRemoteDescription(unpack(answerToken));
    },

    send(obj) {
      if (chan && chan.readyState === 'open') chan.send(JSON.stringify(obj));
    },

    // Optional screen-pixel transport, added live after connect. Either peer
    // may present. Renegotiation reuses the same DataChannel for signaling.
    async shareScreen() {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      screenSender = pc.addTrack(track, stream);
      track.addEventListener('ended', () => { this.stopScreen(); if (h.onscreenend) h.onscreenend(); });
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      this.send({ k: 'rtc-offer', d: pack(pc.localDescription) });
      return stream;
    },
    stopScreen() {
      if (screenSender) { try { pc.removeTrack(screenSender); } catch (_) {} screenSender = null; }
    },

    // Renegotiation messages (screen add/remove) ride the DataChannel.
    async onSignal(msg) {
      if (msg.k === 'rtc-offer') {
        await pc.setRemoteDescription(unpack(msg.d));
        await pc.setLocalDescription(await pc.createAnswer());
        await gathered(pc);
        this.send({ k: 'rtc-answer', d: pack(pc.localDescription) });
      } else if (msg.k === 'rtc-answer') {
        await pc.setRemoteDescription(unpack(msg.d));
      }
    },

    close() {
      try { if (chan) chan.close(); } catch (_) {}
      try { pc.close(); } catch (_) {}
    },
  };
}

// Lamport clock: monotonic logical counter. Each synced unit carries its
// version; the merge in app.js takes the higher version, ties broken by
// peerId so both peers converge deterministically.
export function makeClock() {
  let c = 0;
  return {
    tick() { return ++c; },
    observe(v) { if (typeof v === 'number' && v > c) c = v; },
  };
}
