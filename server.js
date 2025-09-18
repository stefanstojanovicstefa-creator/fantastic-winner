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
      console.log(`⏰ Vreme isteklo za poziv ${callIdFromHeader}. Pokušavam eksternu aktivaciju transfer_call_tool...`);
      
      // Ažuriramo stanje pre poziva API-ja
      const callInfo = ACTIVE_CALLS.get(callIdFromHeader);
      if (callInfo) {
        callInfo.isTransferred = true;
      }

      try {
        // Ispravan Live Call Control endpoint (na osnovu logova iz fajla)
        const controlUrl = `https://phone-call-websocket.aws-us-west-2-backend-production3.vapi.ai/${callIdFromHeader}/control`;
        console.log("🔍 [DEBUG] Signaliziram Vapi da aktivira transfer_call_tool na URL:", controlUrl);

        // Pokušavamo da "aktiviramo" tool po imenu
        const response = await fetch(controlUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json"
          },
          // Ova struktura pokušava da "pokrene" tool po imenu
          body: JSON.stringify({
            "type": "tool-call", // Pretpostavka da postoji ovaj tip
            "toolCall": {
              "function": {
                "name": "transfer_call_tool", // <-- Ime tvog tool-a iz dashboarda
                // Bez argumenata, neka tool koristi svoju unutrašnju konfiguraciju
                "arguments": "{}" 
              }
            }
          })
        });

        // Obrada odgovora kao u prethodnoj verziji (sa text() da izbegnemo 'Body is unusable')
        const responseText = await response.text();
        console.log("📥 [DEBUG] Status odgovora:", response.status);
        console.log("📥 [DEBUG] Sirov odgovor (tekst):", responseText);

        let resultData;
        try {
          resultData = JSON.parse(responseText);
        } catch (parseError) {
          resultData = { message: responseText };
        }

        console.log("✅ Signal za transfer odgovor (status", response.status, "):", JSON.stringify(resultData, null, 2));

        if (!response.ok) {
          console.error(`⚠️ Signal API vraća grešku ${response.status} (${response.statusText})`);
          // Ako eksplicitna aktivacija tool-a ne radi, fallback na osnovni transfer
          console.log("🔄 Pokušavam fallback: osnovni transfer...");
          await fallbackTransfer(callIdFromHeader, controlUrl);
        }

      } catch (error) {
        console.error("❌ Greška prilikom slanja signala za transfer za poziv", callIdFromHeader, ":", error.message);
        console.error(" Stack trace:", error.stack);
        // Ako eksplicitna aktivacija tool-a ne radi, fallback na osnovni transfer
        console.log("🔄 Pokušavam fallback: osnovni transfer...");
        try {
          const controlUrl = `https://phone-call-websocket.aws-us-west-2-backend-production3.vapi.ai/${callIdFromHeader}/control`;
          await fallbackTransfer(callIdFromHeader, controlUrl);
        } catch (fallbackError) {
          console.error("❌ Fallback transfer takođe nije uspeo:", fallbackError.message);
        }
      }
    }, TRANSFER_AFTER_SECONDS * 1000);

    // Sačuvaj informacije o pozivu
    ACTIVE_CALLS.set(callIdFromHeader, { timerId, isTransferred: false });
    console.log(`✅ Timer za poziv ${callIdFromHeader} je uspešno postavljen.`);
  }

  res.status(200).send({ ok: true });
});

// --- FUNKCIJA ZA FALLBACK TRANSFER ---
async function fallbackTransfer(callId, controlUrl) {
  console.log("🔁 Pokretanje fallback transfera za poziv", callId);
  const fallbackResponse = await fetch(controlUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "type": "transfer",
      "destination": {
        "type": "number",
        "number": OPERATOR_NUMBER // "+381637473108"
      },
      "content": "Da ti ne dužim — mislim da će ti moj kolega Ilija pomoći mnogo bolje. Sad ću te prebaciti na njega."
    })
  });

  const fallbackText = await fallbackResponse.text();
  console.log("📥 [DEBUG] Fallback status:", fallbackResponse.status);
  console.log("📥 [DEBUG] Fallback sirovi odgovor:", fallbackText);

  let fallbackResult;
  try {
    fallbackResult = JSON.parse(fallbackText);
  } catch (e) {
    fallbackResult = { message: fallbackText };
  }
  console.log("✅ Fallback transfer odgovor:", JSON.stringify(fallbackResult, null, 2));
}
// --- KRAJ FUNKCIJE ZA FALLBACK ---

// Test ruta
app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Transfer Server je aktivan! (15s timeout - pokušaj warm transfer)');
});

// Pokretanje servera
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server pokrenut na http://localhost:${PORT}`);
  console.log(`✅ Node.js verzija: ${process.version}`);
});
