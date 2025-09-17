// server.js
const express = require('express');
const app = express();

// Middleware da parsira JSON telo
app.use(express.json());

// Konfiguracija
const VAPI_API_KEY = "5e83bb86-06fe-4dc2-80ed-05800f510ad7";
const OPERATOR_NUMBER = "+381637473108";
const TRANSFER_AFTER_SECONDS = 15; // Promenjeno sa 120 na 15
const ACTIVE_TIMERS = new Map(); // Čuva aktivne timere po callId

// Webhook endpoint
app.post('/vapi-webhook', async (req, res) => {
  const event = req.body;
  const eventType = event?.type;

  console.log("📡 [WEBHOOK] Primljen event type:", eventType || "NEMA TYPE");

  // Logujemo raw body samo za debug
  if (eventType === "session.created" || eventType === "call.started") {
    console.log("📥 Raw body za važan event:", JSON.stringify(event, null, 2));
  }

  // Reagujemo na session.created ili call.started
  if (eventType === "session.created" || eventType === "call.started") {
    // Pokušavamo da izvučemo callId iz različitih mogućih mesta
    const callId = event?.data?.id || event?.call?.id || event?.session?.id;

    if (!callId) {
      console.error("❌ callId nije pronađen u eventu!");
      return res.status(400).send("Bad Request: callId nedostaje");
    }

    // Provera da li je već započeo timer za ovaj callId
    if (ACTIVE_TIMERS.has(callId)) {
      console.log(`⚠️ Timer za poziv ${callId} je već aktivan.`);
      return res.status(200).send({ ok: true });
    }

    console.log(`📞 Poziv/session ${callId} je počeo. Startujem timer za ${TRANSFER_AFTER_SECONDS} sekundi.`);

    // Pokreni timer
    const timerId = setTimeout(async () => {
      console.log(`⏰ Vreme isteklo za poziv ${callId}. Pokrećem transfer...`);
      ACTIVE_TIMERS.delete(callId); // Uklanjamo iz mape kada timer istekne

      try {
        // Koristimo built-in fetch (dostupan u Node.js 18+)
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

    // Sačuvaj timer ID da bismo mogli da ga otkažemo ako treba
    ACTIVE_TIMERS.set(callId, timerId);
  }

  // Ako želiš da otkažeš timer na neki drugi event (npr. call.ended), možeš dodati logiku ovde

  res.status(200).send({ ok: true });
});

// Test ruta
app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Transfer Server je aktivan! (15s timeout)');
});

// Pokretanje servera
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server pokrenut na http://localhost:${PORT}`);
});
