import { io } from 'socket.io-client';

const BASE = 'https://silenx.onrender.com';

async function api(path, opts = {}) {
  opts.headers = opts.headers || {};
  opts.headers['Authorization'] = 'Bearer ' + opts.token;
  delete opts.token;
  const res = await fetch(BASE + path, opts);
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

async function main() {
  const aliceToken = 'dev_token_user_aliceabc_uuid_alice_gmail.com';
  const bobToken = 'dev_token_user_bobdefgh_uuid_bob_gmail.com';

  const aliceRes = await api('/api/auth/google', { token: aliceToken });
  const bobRes = await api('/api/auth/google', { token: bobToken });
  console.log('[REST] Alice login:', aliceRes.status, JSON.stringify(aliceRes.body?.user?.uid));
  console.log('[REST] Bob login:', bobRes.status, JSON.stringify(bobRes.body?.user?.uid));

  const aliceUid = aliceRes.body?.user?.uid;
  const bobUid = bobRes.body?.user?.uid;

  const convoRes = await api('/api/conversations', {
    token: aliceToken,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'direct', recipientUid: bobUid }),
  });
  console.log('[REST] Convo create:', convoRes.status, JSON.stringify(convoRes.body));
  const convoId = convoRes.body?.id;
  if (!convoId) { console.log('FAILED: no convo id'); process.exit(1); }

  const aliceId = aliceRes.body?.user?.id;
  const bobId = bobRes.body?.user?.id;
  console.log('[Socket] Alice dbId:', aliceId, 'Bob dbId:', bobId);

  const sockA = io(BASE, { auth: { token: aliceToken }, transports: ['websocket'] });
  const sockB = io(BASE, { auth: { token: bobToken }, transports: ['websocket'] });

  let aConnected = false, bConnected = false;
  let bobReceived = null;
  let aliceAck = null;

  sockA.on('connect', () => { console.log('[Socket A] connected:', sockA.id); aConnected = true; maybeRun(); });
  sockA.on('connect_error', (e) => console.error('[Socket A] error:', e.message));
  sockA.on('message-sent-ack', (p) => { aliceAck = p; console.log('[Socket A] ack:', JSON.stringify(p)); });

  sockB.on('connect', () => { console.log('[Socket B] connected:', sockB.id); bConnected = true; maybeRun(); });
  sockB.on('connect_error', (e) => console.error('[Socket B] error:', e.message));
  sockB.on('receive-message', (p) => { bobReceived = p; console.log('[Socket B] receive-message:', JSON.stringify(p)); });

  let done = false;
  function maybeRun() {
    if (done) return;
    if (!aConnected || !bConnected) return;
    done = true;
    setTimeout(() => {
      const tempId = 'temp_' + Date.now();
      console.log('[Socket A] emitting send-message convo', convoId);
      sockA.emit('send-message', {
        conversationId: convoId,
        tempId,
        encryptedContent: 'hello bro from alice plaintext',
        contentType: 'text',
        recipientId: bobId,
      });
      setTimeout(() => {
        console.log('--- RESULTS ---');
        console.log('Alice ack:', aliceAck ? 'YES' : 'NO');
        console.log('Bob received:', bobReceived ? 'YES' : 'NO');
        if (bobReceived) console.log('Bob got content:', bobReceived.encryptedContent);
        sockA.disconnect();
        sockB.disconnect();
        process.exit(0);
      }, 3000);
    }, 500);
  }

  setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 15000);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });