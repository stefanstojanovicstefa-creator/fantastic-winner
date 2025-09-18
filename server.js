// server.js
const express = require('express');
const app = express();

// Middleware da parsira JSON telo
app.use(express.json({ limit: '10mb' }));

// Konfiguracija
const VAPI_API_KEY = "5e83bb86-06fe-4dc2-80ed-05800f510ad7";
const TRANSFER_AFTER_SECONDS = 15;
// callId -> { timerId, isSignalSent }
const ACTIVE_CALLS = new Map();

// Webhook endpoint - prima webhook-ove od Vapi-a
app.post('/vapi-webhook', async (req, res) => {
  // Pokušavamo da dobijemo callId iz headera
  const callIdFromHeader = req.headers['x-call-id'];

  if (!callIdFromHeader) {
    console.warn("📥 Webhook bez 'x-call-id' headera. Ignorišem.");
    return res.status(200).send({ ok: true });
  }

  const event = req.body;
  const eventType = event?.type || event?.message?.type || "NEMA TYPE";

  // Logujemo sve eventove za debug, ali ne reagujemo osim na specifične
  console.log(`📡 [WEBHOOK] Primljen event type: ${eventType} za poziv ${callIdFromHeader}`);

  // --- LOGIKA ZA POKRETANJE TIMERA NA PRVI WEBHOOK ---
  // Proveravamo da li smo već pokrenuli timer/signal za ovaj poziv
  if (ACTIVE_CALLS.has(callIdFromHeader)) {
    const callInfo = ACTIVE_CALLS.get(callIdFromHeader);
    if (callInfo.isSignalSent) {
      console.log(`🔁 Signal za transfer je već poslat za poziv ${callIdFromHeader}.`);
    } else {
      console.log(`🔁 Timer za poziv ${callIdFromHeader} je već aktivan.`);
    }
  } else {
    // Novi poziv - pokrećemo timer
    console.log(`📞 Novi poziv detektovan preko headera (x-call-id: ${callIdFromHeader}). Startujem timer za ${TRANSFER_AFTER_SECONDS} sekundi.`);
    
    const timerId = setTimeout(async () => {
      console.log(`⏰ Vreme isteklo za poziv ${callIdFromHeader}. Šaljem add-message signal za transfer...`);
      
      // Ažuriramo stanje
      const callInfo = ACTIVE_CALLS.get(callIdFromHeader);
      if (callInfo) {
        callInfo.isSignalSent = true;
      }

      try {
        // Ispravan Live Call Control endpoint (na osnovu logova iz fajla)
        // Koristimo production1 kao u primeru iz zvanične dokumentacije i Vapi logova
        const controlUrl = `https://phone-call-websocket.aws-us-west-2-backend-production1.vapi.ai/${callIdFromHeader}/control`;
        console.log("🔍 [DEBUG] Pokušavam Live Call Control add-message na URL:", controlUrl);

        // Slanje "add-message" koji bi asistent trebalo da prepozna
        // Pretpostavka je da ova poruka aktivira logiku iz prompta:
        // "ko primiš poruku od servera (webhook) sa sadržajem `{ \"type\": \"external_transfer_signal\" }`..."
        const response = await fetch(controlUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            "type": "add-message",
            "message": {
              "role": "system",
              // Ovaj sadržaj treba da prepozna tvoj asistent iz prompta
              "content": "external_transfer_signal"
            },
            // Ovo je ključno da bi asistent obradio poruku
            "triggerResponseEnabled": true 
          })
        });

        const responseText = await response.text();
        console.log("📥 [DEBUG] Status odgovora:", response.status);
        console.log("📥 [DEBUG] Sirov odgovor (tekst):", responseText);

        let resultData;
        try {
          resultData = JSON.parse(responseText);
        } catch (parseError) {
          resultData = { message: responseText };
        }

        console.log("✅ Add-message odgovor (status", response.status, "):", JSON.stringify(resultData, null, 2));

        if (!response.ok) {
          console.error(`⚠️ Add-message API vraća grešku ${response.status} (${response.statusText})`);
        }

      } catch (error) {
        console.error("❌ Greška prilikom slanja add-message za transfer za poziv", callIdFromHeader, ":", error.message);
        // Logujemo stack trace za debugging
        console.error(" Stack trace:", error.stack);
      }
    }, TRANSFER_AFTER_SECONDS * 1000);

    // Sačuvaj informacije o pozivu
    ACTIVE_CALLS.set(callIdFromHeader, { timerId, isSignalSent: false });
    console.log(`✅ Timer za poziv ${callIdFromHeader} je uspešno postavljen.`);
  }
  // --- KRAJ LOGIKE ZA POKRETANJE TIMERA ---

  res.status(200).send({ ok: true });
});

// Test ruta
app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Signal Server je aktivan! (15s timeout - add-message)');
});

// Pokretanje servera
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server pokrenut na http://localhost:${PORT}`);
  console.log(`✅ Node.js verzija: ${process.version}`);
});
