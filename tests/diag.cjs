import { io } from 'socket.io-client';
import fetch from 'node-fetch';

const BASE = 'https://silenx.onrender.com';

async function api(path: string, opts: any = {}) {
  opts.headers = opts.headers || {};
  opts.headers['Authorization'] = `Bearer ${opts.token}`;
  delete opts.token;
  const res = await fetch(BASE + path, opts);
  let body: any = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

async function main() {
  // 1. Create two users via dev-token REST endpoint
  const aliceToken = 'dev_token_user_aliceabc_uuid_alice_gmail.com';
  const bobToken = 'dev_token_user_bobdefgh_uuid_bob_gmail.com';

  const aliceRes = await api('/api/auth/google', { token: aliceToken });
  const bobRes = await api('/api/auth/google', { token: bobToken });
  console.log('[REST] Alice login:', aliceRes.status, aliceRes.body?.user?.uid);
  console.log('[REST] Bob login:', bobRes.status, bobRes.body?.user?.uid);

  const aliceUid = aliceRes.body?.user?.uid;  // SEC_aliceabcuuid
  const bobUid = bobRes.body?.user?.uid;      // SEC_bobdefghuuid

  // 2. Create conversation: Alice creates convo with Bob
  const convoRes = await api('/api/conversations', {
    token: aliceToken,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'direct', recipientUid: bobUid }),
  });
  console.log('[REST] Convo create:', convoRes.status, convoRes.body);
  const convoId = convoRes.body?.id;
  if (!convoId) { console.log('FAILED: no convo id'); process.exit(1); }

  // 3. Connect both users via socket
  const aliceData = aliceRes.body?.user?.id;
  const bobData = bobRes.body?.user?.id;
  console.log('[Socket] Alice id:', aliceData, 'Bob id:', bobData);

  const sockA = io(BASE, { auth: { token: aliceToken }, transports: ['websocket'] });
  const sockB = io(BASE, { auth: { token: bobToken }, transports: ['websocket'] });

  let aConnected = false, bConnected = false;
  let bobReceived = null as any;
  let aliceAck = null as any;

  sockA.on('connect', () => { console.log('[Socket A] connected:', sockA.id); aConnected = true; maybeRun(); });
  sockA.on('connect_error', (e: any) => console.error('[Socket A] error:', e.message));
  sockA.on('message-sent-ack', (p: any) => { aliceAck = p; console.log('[Socket A] ack:', JSON.stringify(p)); });

  sockB.on('connect', () => { console.log('[Socket B] connected:', sockB.id); bConnected = true; maybeRun(); });
  sockB.on('connect_error', (e: any) => console.error('[Socket B] error:', e.message));
  sockB.on('receive-message', (p: any) => { bobReceived = p; console.log('[Socket B] receive-message:', JSON.stringify(p)); });

  let done = false;
  function maybeRun() {
    if (done) return;
    if (!aConnected || !bConnected) return;
    done = true;
    setTimeout(() => {
      const tempId = 'temp_' + Date.now();
      console.log('[Socket A] emitting send-message convo', convoId, 'to bob id', bobData);
      sockA.emit('send-message', {
        conversationId: convoId,
        tempId,
        encryptedContent: 'hello bro from alice plaintext',
        contentType: 'text',
        recipientId: bobData,
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

  // timeout safety
  setTimeout(() => { process.exit(1); }, 15000);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
