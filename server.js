// server.js
const express = require('express');
const app = express();

// Middleware da parsira JSON telo
app.use(express.json());

// Middleware za logovanje svih dolazećih webhook zahteva (za debug)
app.use('/vapi-webhook', (req, res, next) => {
  console.log("\n--- DEBUG: NOVI WEBHOOK ZAHTEV ---");
  console.log("📥 [DEBUG] Metod:", req.method);
  console.log("📥 [DEBUG] Putanja:", req.originalUrl);
  console.log("📥 [DEBUG] Headers:", JSON.stringify(req.headers, null, 2));
  // Telo će biti logovano u glavnom handleru
  console.log("--- KRAJ DEBUG INFO ---\n");
  next(); // Nastavi sa sledećim handlerom
});

// Konfiguracija
const VAPI_API_KEY = "5e83bb86-06fe-4dc2-80ed-05800f510ad7";
const OPERATOR_NUMBER = "+381637473108";
const TRANSFER_AFTER_SECONDS = 15; // Promenjeno sa 120 na 15
const ACTIVE_TIMERS = new Map(); // Čuva aktivne timere po callId

// Webhook endpoint
app.post('/vapi-webhook', async (req, res) => {
  let events = req.body;

  // Logujemo sirovo telo za debug ako je potrebno
  // console.log("📥 [DEBUG] Sirovo telo (req.body):", JSON.stringify(req.body, null, 2));

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

  // Ako tip nije prepoznat, logujemo čitav objekat za debug
  if (!eventType || eventType === "NEMA TYPE") {
    console.log("📥 [DEBUG] Sirovo telo zahteva (event) jer type nije prepoznat:", JSON.stringify(event, null, 2));
  }

  // Reagujemo na session.created ili call.started
  if (eventType === "session.created" || eventType === "call.started") {
    // Pokušavamo da izvučemo callId iz različitih mogućih mesta
    const callId =
      event?.data?.id ||
      event?.call?.id ||
      event?.session?.id ||
      event?.message?.data?.id;

    if (!callId) {
      console.error("❌ callId nije pronađen u eventu!");
      return;
    }

    if (ACTIVE_TIMERS.has(callId)) {
      console.log(`⚠️ Timer za poziv ${callId} je već aktivan.`);
      return;
    }

    console.log(
      `📞 Poziv/session ${callId} je počeo. Startujem timer za ${TRANSFER_AFTER_SECONDS} sekundi.`
    );

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
        console.log("✅ Transfer odgovor:", JSON.stringify(result, null, 2));
      } catch (error) {
        console.error("❌ Greška prilikom transfera:", error.message);
        // Logujemo stack trace za više detalja
        console.error(" Stack trace:", error.stack);
      }
    }, TRANSFER_AFTER_SECONDS * 1000);

    // Sačuvaj timer ID da bismo mogli da ga otkažemo ako treba
    ACTIVE_TIMERS.set(callId, timerId);
  }
  // Možeš dodati logiku i za druge eventove ako je potrebno
  // npr. da otkažeš timer ako se poziv završi pre vremena
  else if (eventType === "call.ended" || (eventType === "status-update" && event?.status === "ended")) {
     const callId =
      event?.data?.id ||
      event?.call?.id ||
      event?.session?.id ||
      event?.message?.data?.id;

    if (callId && ACTIVE_TIMERS.has(callId)) {
       console.log(`🛑 Poziv ${callId} je završen pre isteka timera. Otkazujem timer.`);
       const timerId = ACTIVE_TIMERS.get(callId);
       clearTimeout(timerId);
       ACTIVE_TIMERS.delete(callId);
    }
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
});
