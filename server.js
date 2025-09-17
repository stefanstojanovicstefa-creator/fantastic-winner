const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const VAPI_API_KEY = "5e83bb86-06fe-4dc2-80ed-05800f510ad7";
const OPERATOR_NUMBER = "+381637473108";
const TRANSFER_AFTER_SECONDS = 120;

app.post('/vapi-webhook', async (req, res) => {
  const event = req.body;

  console.log("📡 [WEBHOOK] Primljen event:", event?.type);

  if (event?.type === "call.started") {
    const callId = event.data.id;

    console.log(`📞 Poziv ${callId} je počeo. Startujem timer za ${TRANSFER_AFTER_SECONDS} sekundi.`);

    setTimeout(async () => {
      console.log(`⏰ Vreme isteklo za poziv ${callId}. Pokrećem transfer...`);

      try {
        const response = await fetch("https://api.vapi.ai/call/transfer", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            callId: callId,
            destinations: [
              {
                type: "number",
                number: OPERATOR_NUMBER
              }
            ]
          })
        });

        const result = await response.json();
        console.log("✅ Transfer odgovor:", result);
      } catch (error) {
        console.error("❌ Greška prilikom transfera:", error.message);
      }
    }, TRANSFER_AFTER_SECONDS * 1000);
  }

  res.status(200).send({ ok: true });
});

app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Transfer Server je aktivan!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server pokrenut na portu ${PORT}`);
=======
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const VAPI_API_KEY = "5e83bb86-06fe-4dc2-80ed-05800f510ad7";
const OPERATOR_NUMBER = "+381637473108";
const TRANSFER_AFTER_SECONDS = 120;

app.post('/vapi-webhook', async (req, res) => {
  const event = req.body;

  console.log("📡 [WEBHOOK] Primljen event:", event?.type);

  if (event?.type === "call.started") {
    const callId = event.data.id;

    console.log(`📞 Poziv ${callId} je počeo. Startujem timer za ${TRANSFER_AFTER_SECONDS} sekundi.`);

    setTimeout(async () => {
      console.log(`⏰ Vreme isteklo za poziv ${callId}. Pokrećem transfer...`);

      try {
        const response = await fetch("https://api.vapi.ai/call/transfer", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            callId: callId,
            destinations: [
              {
                type: "number",
                number: OPERATOR_NUMBER
              }
            ]
          })
        });

        const result = await response.json();
        console.log("✅ Transfer odgovor:", result);
      } catch (error) {
        console.error("❌ Greška prilikom transfera:", error.message);
      }
    }, TRANSFER_AFTER_SECONDS * 1000);
  }

  res.status(200).send({ ok: true });
});

app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Transfer Server je aktivan!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server pokrenut na portu ${PORT}`);
});

