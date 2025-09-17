// server.js
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json({ type: 'application/json' }));

// Mapa za čuvanje timer-a po callId
const callTimers = new Map();

// 🔑 Vapi API config
const VELPI_API_KEY = 'vk-xxxxxx'; // stavi svoj pravi ključ
const VELPI_API_URL = 'https://api.vapi.ai/call';

async function sendVapiCommand(callId, command, data) {
  if (!callId) return;

  try {
    const response = await axios.post(
      `${VELPI_API_URL}/${callId}/${command}`,
      data,
      {
        headers: {
          Authorization: `Bearer ${VELPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ [VAPI] ${command} sent for call ${callId}`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ [VAPI ERROR] ${command} for call ${callId}:`, error.message);
    if (error.response) console.error(error.response.data);
  }
}

// Webhook endpoint
app.post('/vapi-webhook', async (req, res) => {
  const message = req.body?.message;
  if (!message) return res.status(400).send('No message');

  const event = message.type;
  const callId = message.call?.id;

  console.log(`📡 [EVENT] ${event} | callId: ${callId}`);

  if (!event || !callId) return res.status(400).send('Missing event or callId');

  // ✅ Kada poziv krene (queued ili in-progress)
  if (
    event === 'status-update' &&
    (message.status === 'queued' || message.status === 'in-progress')
  ) {
    console.log(`📞 [CALL STARTED] ${callId}. Palim timere...`);

    // 1. Timer za soft transfer (165s)
    const transferTimer = setTimeout(async () => {
      console.log(`⏰ [SOFT TRANSFER] 165s prošlo za ${callId}. Kažem poruku + transfer.`);

      // AI kaže fiksnu poruku
      await sendVapiCommand(callId, 'say', {
        message:
          "Ćao {{firstName}}, da ti ne dužim — mislim da će ti moj kolega Ilija pomoći mnogo bolje. Sad ću te prebaciti na njega.",
        type: 'text',
      });

      // sačekaj 2s da poruka zvuči prirodno
      setTimeout(async () => {
        await sendVapiCommand(callId, 'transfer', {
          to: '+381637434108', // broj ljudskog agenta
          whisper: "Lead iz {{industry}}. Ime: {{firstName}}.",
        });
      }, 2000);
    }, 165000); // 165s

    // 2. Hard cut (180s)
    const hardCutTimer = setTimeout(() => {
      console.log(`🛑 [HARD CUT] 180s prošlo za ${callId}. Gasim poziv.`);
      sendVapiCommand(callId, 'end', {});
    }, 180000);

    // čuvamo oba timera
    callTimers.set(callId, [transferTimer, hardCutTimer]);
  }

  // ✅ Kada se poziv završi — čistimo sve timere
  if (event === 'status-update' && message.status === 'ended') {
    const timers = callTimers.get(callId);
    if (timers) {
      timers.forEach(clearTimeout);
      callTimers.delete(callId);
      console.log(`🧹 [CLEANUP] Timers cleared for ${callId}`);
    }
  }

  res.status(200).send('OK');
});

// Health check
app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Timeout Server is running!');
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ [SERVER] Running on port ${PORT}`);
});
