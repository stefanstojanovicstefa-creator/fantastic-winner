// server.js
const express = require('express');
const app = express();

// Middleware da parsira JSON telo
app.use(express.json({ limit: '10mb' }));

// Konfiguracija
const VAPI_API_KEY = "5e83bb86-06fe-4dc2-80ed-05800f510ad7";
// URL ka kojem asistent šalje webhook-ove (tvoj server)
// Ovo mora da bude tačan URL koji je konfigurisan u asistentovoj "server.url" opciji u Vapi dashboardu
const ASSISTANT_SERVER_URL = "https://fantastic-winner-1.onrender.com/vapi-webhook"; 
const TRANSFER_AFTER_SECONDS = 15;
// callId -> { timerId, isTransferred }
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

  // Provera da li je ovo signal za transfer koji smo mi poslali
  if (eventType === "external_transfer_signal") {
    console.log(`📩 Primljen signal za transfer za poziv ${callIdFromHeader}.`);
    // Ovde možeš logovati ili izvršiti dodatnu logiku ako treba
    // Asistent bi trebalo da reaguje na ovu poruku i sam aktivirati tool
    return res.status(200).send({ ok: true });
  }

  // Standardna logika za detekciju poziva
  if (eventType === "session.created" || eventType === "call.started") {
    // Proveravamo da li smo već pokrenuli timer/transfer za ovaj poziv
    if (ACTIVE_CALLS.has(callIdFromHeader)) {
      const callInfo = ACTIVE_CALLS.get(callIdFromHeader);
      if (callInfo.isTransferred) {
        console.log(`🔁 Poziv ${callIdFromHeader} je već signaliziran za transfer.`);
      } else {
        console.log(`🔁 Već poznat poziv ${callIdFromHeader}. Timer već aktivan.`);
      }
    } else {
      // Novi poziv - pokrećemo timer
      console.log(`📞 Novi poziv detektovan preko headera (x-call-id: ${callIdFromHeader}). Startujem timer za ${TRANSFER_AFTER_SECONDS} sekundi.`);
      
      const timerId = setTimeout(async () => {
        console.log(`⏰ Vreme isteklo za poziv ${callIdFromHeader}. Šaljem signal za transfer...`);
        
        // Ažuriramo stanje
        const callInfo = ACTIVE_CALLS.get(callIdFromHeader);
        if (callInfo) {
          callInfo.isTransferred = true;
        }

        try {
          // Slanje signala nazad asistentu na njegov server.url
          // Ovo je ekvivalent "obavesti asistenta da je vreme"
          const signalResponse = await fetch(ASSISTANT_SERVER_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Opcionalno: Prosledi callId ako server treba da ga koristi
              // Ovde koristimo custom header jer nema smisla slati Bearer token samom sebi
              // "x-call-id": callIdFromHeader 
            },
            // Signal koji asistent treba da prepozna
            body: JSON.stringify({
              "type": "external_transfer_signal",
              "callId": callIdFromHeader, // Dodatna informacija ako treba
              "timestamp": new Date().toISOString()
            })
          });

          if (signalResponse.ok) {
            console.log(`✅ Signal za transfer uspešno poslat nazad asistentu za poziv ${callIdFromHeader}.`);
          } else {
            const signalErrorText = await signalResponse.text();
            console.error(`⚠️ Greška pri slanju signala. Status: ${signalResponse.status}`, signalErrorText);
          }

        } catch (error) {
          console.error("❌ Greška prilikom slanja signala za transfer za poziv", callIdFromHeader, ":", error.message);
          console.error(" Stack trace:", error.stack);
        }
      }, TRANSFER_AFTER_SECONDS * 1000);

      // Sačuvaj informacije o pozivu
      ACTIVE_CALLS.set(callIdFromHeader, { timerId, isTransferred: false });
      console.log(`✅ Timer za poziv ${callIdFromHeader} je uspešno postavljen.`);
    }
  } else {
    // Logujemo druge eventove ako želimo, ali ne reagujemo
    console.log(`📡 [WEBHOOK] Primljen event type: ${eventType} za poziv ${callIdFromHeader}`);
  }

  res.status(200).send({ ok: true });
});

// Test ruta
app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Signal Server je aktivan! (15s timeout - šalje signal)');
});

// Pokretanje servera
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server pokrenut na http://localhost:${PORT}`);
  console.log(`✅ Node.js verzija: ${process.version}`);
});
