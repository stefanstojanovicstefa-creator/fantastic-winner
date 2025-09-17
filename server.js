// server.js
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Tvoj Vapi API ključ
const VAPI_API_KEY = 'vk-zN2YzZjM2ItNjEwYS00ODZlLTk1MjctZmM5MjQ4YjYwMjJlLWIxNmU0ZGU3';
const VAPI_BASE_URL = 'https://api.vapi.ai';

// Memorija za timere
const callTimers = new Map();

// Funkcija za slanje tool-call response
async function sendToolCallResponse(callId, toolCallId, output) {
  try {
    const response = await axios.post(
      `${VAPI_BASE_URL}/call/${callId}/tool-calls/${toolCallId}/result`,
      {
        result: output || { success: true }
      },
      {
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Tool-call response sent for call ${callId}`, response.data);
  } catch (error) {
    console.error(`❌ Error sending tool-call response for call ${callId}:`, error.message);
  }
}

// Webhook endpoint
app.post('/vapi-webhook', async (req, res) => {
  const message = req.body?.message;
  if (!message) {
    console.error('❌ No message in webhook payload');
    return res.status(400).send('Bad Request: No message');
  }

  const event = message.type;
  const callId = message.call?.id;

  console.log('📡 [EVENT]', event, '| callId:', callId);

  if (!event || !callId) {
    return res.status(400).send('Missing event or callId');
  }

  // ✅ Kad poziv krene
  if (event === 'status-update' && (message.status === 'queued' || message.status === 'in-progress')) {
    console.log(`📞 [CALL STARTED] ${callId}. Starting 15s timer...`);

    const timer = setTimeout(async () => {
      console.log(`⏰ [TIMEOUT] 15s passed. Triggering transfer_call_tool for call ${callId}...`);

      // Generiši toolCallId (može biti bilo šta jedinstveno)
      const toolCallId = `timeout_transfer_${Date.now()}`;

      // Pošalji tool-call response
      await sendToolCallResponse(callId, toolCallId, {
        toolCallId,
        name: 'transfer_call_tool',
        parameters: {}
      });
    }, 15000); // 15 sekundi

    callTimers.set(callId, timer);
  }

  // ✅ Kad se poziv završi
  if (event === 'status-update' && message.status === 'ended') {
    const timer = callTimers.get(callId);
    if (timer) {
      clearTimeout(timer);
      callTimers.delete(callId);
      console.log(`🧹 [CLEANUP] Timer cleared for call ${callId}`);
    }
  }

  res.status(200).send('OK');
});

// Health check
app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Timeout Server is running!');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ [SERVER] Running on port ${PORT}`);
});