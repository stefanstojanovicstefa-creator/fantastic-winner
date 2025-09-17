// server.js
const express = require('express');
const app = express();

// Middleware da parsira JSON telo
app.use(express.json({ limit: '10mb' })); // Povecavamo limit za velike payload-ove

// Middleware za logovanje svih dolazećih webhook zahteva (za debug)
app.use('/vapi-webhook', (req, res, next) => {
  console.log("\n--- DEBUG: NOVI WEBHOOK ZAHTEV ---");
  console.log("📥 [DEBUG] Metod:", req.method);
  console.log("📥 [DEBUG] Putanja:", req.originalUrl);
  // Logujemo samo neke bitne headere da ne zagusimo logove
  const relevantHeaders = {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length'],
    'x-call-id': req.headers['x-call-id']
  };
  console.log("📥 [DEBUG] Relevantni Headers:", JSON.stringify(relevantHeaders));
  next();
});

// Konfiguracija
const VAPI_API_KEY = "5e83bb86-06fe-4dc2-80ed-05800f510ad7";
const OPERATOR_NUMBER = "+381637473108";
const TRANSFER_AFTER_SECONDS = 15;
const ACTIVE_TIMERS = new Map();

// Webhook endpoint
app.post('/vapi-webhook', async (req, res) => {
  let events = req.body;

  // Ako je telo niz, procesiraj svaki event
  if (Array.isArray(events)) {
    console.log(`📥 [DEBUG] Primljen niz eventova, broj elemenata: ${events.length}`);
    for (const event of events) {
      await processEvent(event);
    }
  } else {
    // Ako je jedan objekat, procesiraj ga
    await processEvent(events);
  }

  res.status(200).send({ ok: true });
});

// Funkcija za obradu jednog eventa
async function processEvent(event) {
  // Pokušaj da pronađeš type na više načina
  const eventType = event?.type || event?.message?.type || "NEMA TYPE";

  console.log("📡 [WEBHOOK] Primljen event type:", eventType);

  // Reagujemo na session.created ili call.started
  if (eventType === "session.created" || eventType === "call.started") {
    console.log("🔍 [DEBUG] Obrada session.created/call.started eventa započeta.");

    // Pokušavamo da izvučemo callId iz različitih mogućih mesta
    const callIdFromData = event?.data?.id;
    const callIdFromCall = event?.call?.id;
    const callIdFromSession = event?.session?.id;
    const callIdFromMessageData = event?.message?.data?.id;

    console.log("🔍 [DEBUG] Pokušaji ekstrakcije callId:", {
      "event.data.id": callIdFromData,
      "event.call.id": callIdFromCall,
      "event.session.id": callIdFromSession,
      "event.message.data.id": callIdFromMessageData
    });

    // Koristimo prvi koji postoji
    const callId = callIdFromData || callIdFromCall || callIdFromSession || callIdFromMessageData;

    if (!callId) {
      console.error("❌ callId nije pronađen u eventu! Preskačem obradu.");
      // Logujemo ceo event za dodatnu dijagnostiku
      console.error("📥 [DEBUG] Event bez callId:", JSON.stringify(event, null, 2));
      return;
    }

    console.log(`🔍 [DEBUG] Ekstrahovani callId: ${callId}`);

    if (ACTIVE_TIMERS.has(callId)) {
      console.log(`⚠️ Timer za poziv ${callId} je već aktivan. Preskačem.`);
      return;
    }

    console.log(
      `📞 Poziv/session ${callId} je počeo. Startujem timer za ${TRANSFER_AFTER_SECONDS} sekundi.`
    );

    const timerId = setTimeout(async () => {
      console.log(`⏰ Vreme isteklo za poziv ${callId}. Pokrećem transfer...`);
      ACTIVE_TIMERS.delete(callId);

      try {
        // Koristimo built-in fetch (dostupan u Node.js 18+)
        // VAZNO: Ne koristimo require('node-fetch') nигде
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
        console.log("✅ Transfer odgovor:", JSON.stringify(result, null, 2));
      } catch (error) {
        console.error("❌ Greška prilikom transfera:", error.message);
        console.error(" Stack trace:", error.stack);
      }
    }, TRANSFER_AFTER_SECONDS * 1000);

    ACTIVE_TIMERS.set(callId, timerId);
    console.log(`✅ Timer za poziv ${callId} je uspešno postavljen.`);
  }
  // Logika za prekid poziva ako je potrebno
  else if (eventType === "call.ended" || (eventType === "status-update" && event?.status === "ended")) {
    const callId = event?.data?.id || event?.call?.id || event?.session?.id || event?.message?.data?.id;
    if (callId && ACTIVE_TIMERS.has(callId)) {
      console.log(`🛑 Poziv ${callId} je završen pre isteka timera. Otkazujem timer.`);
      const timerId = ACTIVE_TIMERS.get(callId);
      clearTimeout(timerId);
      ACTIVE_TIMERS.delete(callId);
    }
  }
  // Ako tip nije prepoznat, logujemo čitav objekat za debug (samo jednom da ne zagusimo logove)
  else if (eventType === "NEMA TYPE") {
    console.log("📥 [DEBUG] Sirovo telo zahteva (event) jer type nije prepoznat (prvi primer):", JSON.stringify(event, null, 2));
  }
}

// Test ruta
app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Transfer Server je aktivan! (15s timeout)');
});

// Pokretanje servera
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server pokrenut na http://localhost:${PORT}`);
  // Provera verzije Node.js
  console.log(`✅ Node.js verzija: ${process.version}`);
});
