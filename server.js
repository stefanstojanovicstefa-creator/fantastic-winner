// server.js
const express = require('express');
const app = express();

// Middleware da parsira JSON telo
app.use(express.json({ limit: '10mb' }));

// Konfiguracija
const VAPI_API_KEY = "5e83bb86-06fe-4dc2-80ed-05800f510ad7";
const OPERATOR_NUMBER = "+381637473108";
const TRANSFER_AFTER_SECONDS = 15;
const ACTIVE_CALLS = new Map(); // Čuva informacije o pozivima: callId -> { timerId, startedEventReceived }

// Webhook endpoint
app.post('/vapi-webhook', async (req, res) => {
  // Pokušavamo da dobijemo callId iz headera
  const callIdFromHeader = req.headers['x-call-id'];

  if (!callIdFromHeader) {
    console.warn("📥 Webhook bez 'x-call-id' headera. Ignorišem.");
    return res.status(200).send({ ok: true });
  }

  // Proveravamo da li već imamo informacije o ovom pozivu
  if (ACTIVE_CALLS.has(callIdFromHeader)) {
    const callInfo = ACTIVE_CALLS.get(callIdFromHeader);
    console.log(`🔁 Već poznat poziv ${callIdFromHeader}. Timer već aktivan: ${!!callInfo.timerId}`);
    // Ako je već završen, uklanjamo ga
    // Ovo možeš proširiti ako primaš 'call.ended' event
  } else {
    // Novi poziv - pokrećemo timer
    console.log(`📞 Novi poziv detektovan preko headera (x-call-id: ${callIdFromHeader}). Startujem timer za ${TRANSFER_AFTER_SECONDS} sekundi.`);

    const timerId = setTimeout(async () => {
      console.log(`⏰ Vreme isteklo za poziv ${callIdFromHeader}. Pokrećem transfer...`);
      ACTIVE_CALLS.delete(callIdFromHeader); // Uklanjamo iz mape kada timer istekne

      try {
        const response = await fetch("https://api.vapi.ai/call/transfer", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            callId: callIdFromHeader, // Koristimo callId iz headera
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
        console.error("❌ Greška prilikom transfera za poziv", callIdFromHeader, ":", error.message);
        console.error(" Stack trace:", error.stack);
      }
    }, TRANSFER_AFTER_SECONDS * 1000);

    // Sačuvaj informacije o pozivu
    ACTIVE_CALLS.set(callIdFromHeader, { timerId });
    console.log(`✅ Timer za poziv ${callIdFromHeader} je uspešno postavljen.`);
  }

  // Opcionalno: Ako želiš da reaguješ i na određene tipove eventova iz tela
  // (npr. ako želiš da otkažeš timer kad se poziv završi)
  // Ovde možeš dodati logiku za parsiranje tela req.body

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
