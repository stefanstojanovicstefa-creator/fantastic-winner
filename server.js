// server.js
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// Mapa za čuvanje timer-a po callId
const callTimers = new Map();

// Tvoj Velpi API ključ i base URL
const VELPI_API_KEY = 'vk-zN2YzZjM2ItNjEwYS00ODZlLTk1MjctZmM5MjQ4YjYwMjJlLWIxNmU0ZGU3';
const VELPI_API_URL = 'https://api.vapi.ai/call';

// Funkcija za slanje komande Vapi-ju
async function sendVapiCommand(callId, command, data) {
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
    console.error(`❌ [VAPI ERROR] Failed to send ${command} for call ${callId}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`, error.response.data);
    }
  }
}

// Webhook endpoint
app.post('/vapi-webhook', async (req, res) => {
  const { event, callId } = req.body;

  console.log(`📡 [WEBHOOK] Received event: ${event} for callId: ${callId}`);

  if (event === 'call.started') {
    console.log(`📞 [CALL STARTED] Call ${callId} has started. Starting 15s timer...`);

    // Pali timer od 15 sekundi (za test)
    const timer = setTimeout(async () => {
      console.log(`⏰ [TIMER EXPIRED] 15 seconds passed for call ${callId}. Triggering transfer sequence...`);

      // 1. Kaži fiksnu poruku
      await sendVapiCommand(callId, 'say', {
        message: "Ćao {{firstName}}, da ti ne dužim — mislim da će ti moj kolega Ilija reći sve što ti treba mnogo bolje. Sad ću te prebaciti na njega.",
        type: "text",
      });

      // 2. Sačekaj 2 sekunde da poruka zvuči prirodno
      setTimeout(async () => {
        console.log(`🔀 [TRANSFER] Attempting to transfer call ${callId} to ILU...`);
        // 3. Transferuj na ILU
        await sendVapiCommand(callId, 'transfer', {
          to: "+381637434108",
          whisper: "TEST CALL: Lead iz {{industry}}. Ime: {{firstName}}.",
        });
      }, 2000);
    }, 15000); // 15 sekundi = 15000 ms

    // Sačuvaj timer da možeš da ga poništiš ako poziv završi ranije
    callTimers.set(callId, timer);

    // Pali hard limit od 30 sekundi (auto hangup)
    setTimeout(() => {
      console.log(`🛑 [HARD LIMIT] 30 seconds reached for call ${callId}. Ending call.`);
      sendVapiCommand(callId, 'end', {});
    }, 30000);
  }

  // Ako se poziv završi, poništi timer
  if (event === 'call.ended' || event === 'call.transferred') {
    const timer = callTimers.get(callId);
    if (timer) {
      clearTimeout(timer);
      callTimers.delete(callId);
      console.log(`🧹 [CLEANUP] Timer cleared for call ${callId}`);
    }
  }

  res.status(200).send('OK');
});

// Health check ruta (da ne dobijaš Cannot GET /)
app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Timeout Server is ALIVE and ready for testing!');
});

// Pokreni server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ [SERVER] Webhook server is RUNNING on port ${PORT}`);
  console.log(`🔗 Access health check at: http://localhost:${PORT}`);
});