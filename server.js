// server.js
const express = require('express');
const app = express();

// Middleware da parsira JSON telo
app.use(express.json({ limit: '10mb' })); // Povecavamo limit za velike payload-ove

// Konfiguracija
const VAPI_API_KEY = "5e83bb86-06fe-4dc2-80ed-05800f510ad7";
const OPERATOR_NUMBER = "+381637473108";
const TRANSFER_AFTER_SECONDS = 15;
const ACTIVE_CALLS = new Set(); // Čuva callId-jeve za koje je timer već pokrenut

// Webhook endpoint
app.post('/vapi-webhook', async (req, res) => {
  // Pokušavamo da dobijemo callId iz headera
  const callIdFromHeader = req.headers['x-call-id'];

  if (!callIdFromHeader) {
    console.warn("📥 Webhook bez 'x-call-id' headera. Ignorišem.");
    return res.status(200).send({ ok: true });
  }

  // Proveravamo da li smo već pokrenuli timer za ovaj poziv
  if (ACTIVE_CALLS.has(callIdFromHeader)) {
    console.log(`🔁 Već poznat poziv ${callIdFromHeader}. Timer već aktivan.`);
  } else {
    // Novi poziv - pokrećemo timer
    console.log(`📞 Novi poziv detektovan preko headera (x-call-id: ${callIdFromHeader}). Startujem timer za ${TRANSFER_AFTER_SECONDS} sekundi.`);
    ACTIVE_CALLS.add(callIdFromHeader); // Označavamo da je timer pokrenut

    setTimeout(async () => {
      console.log(`⏰ Vreme isteklo za poziv ${callIdFromHeader}. Pokrećem transfer...`);
      ACTIVE_CALLS.delete(callIdFromHeader); // Uklanjamo iz seta kada timer istekne

      try {
        // Ispravan Live Call Control endpoint (na osnovu logova iz fajla)
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
            "content": "Prebacujem vas na operatera." // Opcionalna poruka
          })
        });

        const result = await response.json();
        console.log("✅ Transfer odgovor (status", response.status, "):", JSON.stringify(result, null, 2));

        if (!response.ok) {
          console.error(`⚠️ Transfer API vraća grešku ${response.status} (${response.statusText})`);
        }
      } catch (error) {
        console.error("❌ Greška prilikom transfera za poziv", callIdFromHeader, ":", error.message);
        console.error(" Stack trace:", error.stack);
      }
    }, TRANSFER_AFTER_SECONDS * 1000);

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
