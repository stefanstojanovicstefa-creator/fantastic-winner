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

// Funkcija za slanje komande Velpi-ju
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
    console.log(`✅ ${command} sent for call ${callId}`, response.data);
  } catch (error) {
    console.error(`❌ Error sending ${command} for call ${callId}:`, error.message);
  }
}

// Webhook endpoint
app.post('/vapi-webhook', async (req, res) => {
  const { event, callId } = req.body;

  if (event === 'call.started') {
    console.log(`📞 Call started: ${callId}`);

    // Pali timer od 165 sekundi (2:45)
    const timer = setTimeout(async () => {
      console.log(`⏰ Timer expired for call ${callId}`);

      // 1. Kaži prirodnu poruku (LLM će je generisati, ali sa jasnom instrukcijom)
      await sendVapiCommand(callId, 'say', {
        message: "Možeš da kažeš nešto u stilu: 'Ćao {{firstName}}, da ti ne dužim — mislim da će ti moj kolega Ilija reći sve što ti treba mnogo bolje. Sad ću te prebaciti na njega.'",
        type: "text",
      });

      // 2. Sačekaj 5 sekundi da poruka zvuči prirodno
      setTimeout(async () => {
        // 3. Transferuj na ILU preko Vapi transfer tool-a
        await sendVapiCommand(callId, 'transfer', {
          to: "+381637434108",
          whisper: "Lead iz {{industry}}. Ime: {{firstName}}. Score: {{interestScore}}.",
        });
      }, 5000);
    }, 165000); // 165 sekundi = 2:45

    // Sačuvaj timer da možeš da ga poništiš ako poziv završi ranije
    callTimers.set(callId, timer);
  }

  // Ako se poziv završi, poništi timer
  if (event === 'call.ended' || event === 'call.transferred') {
    const timer = callTimers.get(callId);
    if (timer) {
      clearTimeout(timer);
      callTimers.delete(callId);
      console.log(`🛑 Timer cleared for call ${callId}`);
    }
  }

  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
});