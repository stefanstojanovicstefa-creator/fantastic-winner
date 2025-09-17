// server.js
const express = require('express');
const app = express();

// Middleware da parsira JSON telo
app.use(express.json({ limit: '10mb' }));

// Konfiguracija
const VAPI_API_KEY = "5e83bb86-06fe-4dc2-80ed-05800f510ad7";
const OPERATOR_NUMBER = "+381637473108";
const TRANSFER_AFTER_SECONDS = 15;
// callId -> { timerId, isTransferred }
const ACTIVE_CALLS = new Map();

// Webhook endpoint
app.post('/vapi-webhook', async (req, res) => {
  // Pokušavamo da dobijemo callId iz headera
  const callIdFromHeader = req.headers['x-call-id'];

  if (!callIdFromHeader) {
    console.warn("📥 Webhook bez 'x-call-id' headera. Ignorišem.");
    return res.status(200).send({ ok: true });
  }

  // Proveravamo da li smo već pokrenuli timer/transfer za ovaj poziv
  if (ACTIVE_CALLS.has(callIdFromHeader)) {
    const callInfo = ACTIVE_CALLS.get(callIdFromHeader);
    if (callInfo.isTransferred) {
      console.log(`🔁 Poziv ${callIdFromHeader} je već transferisan.`);
    } else {
      console.log(`🔁 Već poznat poziv ${callIdFromHeader}. Timer već aktivan.`);
    }
  } else {
    // Novi poziv - pokrećemo timer
    console.log(`📞 Novi poziv detektovan preko headera (x-call-id: ${callIdFromHeader}). Startujem timer za ${TRANSFER_AFTER_SECONDS} sekundi.`);
    
    const timerId = setTimeout(async () => {
      console.log(`⏰ Vreme isteklo za poziv ${callIdFromHeader}. Pokrećem transfer...`);
      
      // Ažuriramo stanje pre poziva API-ja
      const callInfo = ACTIVE_CALLS.get(callIdFromHeader);
      if (callInfo) {
        callInfo.isTransferred = true;
      }

      try {
        // Ispravan Live Call Control endpoint
        const controlUrl = `https://phone-call-websocket.aws-us-west-2-backend-production3.vapi.ai/${callIdFromHeader}/control`;
        console.log("🔍 [DEBUG] Pokušavam Live Call Control transfer na URL:", controlUrl);

        const response = await fetch(controlUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            "type": "transfer",
            "destination": {
              "type": "number",
              "number": OPERATOR_NUMBER
            },
            "content": "Da ti ne dužim — mislim da će ti moj kolega Ilija pomoći mnogo bolje. Sad ću te prebaciti na njega."
          })
        });

        // Pokušaj parsiranja JSON-a, sa fallback-om za tekst
        let result;
        try {
          result = await response.json();
        } catch (jsonError) {
          const errorText = await response.text();
          console.error("❌ Nije validan JSON odgovor:", errorText);
          console.log("✅ Transfer odgovor (status", response.status, "):", errorText || "Nema sadržaja");
          if (!response.ok) {
            console.error(`⚠️ Transfer API vraća grešku ${response.status} (${response.statusText})`);
          }
          return;
        }

        // Ako smo uspešno parsirali JSON
        console.log("✅ Transfer odgovor (status", response.status, "):", JSON.stringify(result, null, 2));
        if (!response.ok) {
          console.error(`⚠️ Transfer API vraća grešku ${response.status} (${response.statusText})`);
        }
      } catch (error) {
        console.error("❌ Greška prilikom transfera za poziv", callIdFromHeader, ":", error.message);
        console.error(" Stack trace:", error.stack);
      }
    }, TRANSFER_AFTER_SECONDS * 1000);

    // Sačuvaj informacije o pozivu
    ACTIVE_CALLS.set(callIdFromHeader, { timerId, isTransferred: false });
    console.log(`✅ Timer za poziv ${callIdFromHeader} je uspešno postavljen.`);
  }

  res.status(200).send({ ok: true });
});

// Test ruta
app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Transfer Server je aktivan! (15s timeout na prvi webhook)');
});

// Pokretanje servera
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server pokrenut na http://localhost:${PORT}`);
  console.log(`✅ Node.js verzija: ${process.version}`);
});
