const express = require('express');
const app = express();

// Middleware da parsira JSON telo
app.use(express.json());

app.post('/vapi-webhook', async (req, res) => {
  console.log("📥 Raw headers:", req.headers);
  console.log("📥 Raw body string:", JSON.stringify(req.body, null, 2));

  const event = req.body;

  console.log("📡 [WEBHOOK] Primljen event type:", event?.type || "NEMA TYPE");

  // ✅ Ako je poziv upravo započeo
  if (event?.type === "call.started") {
    const callId = event.data?.id;

    if (!callId) {
      console.error("❌ callId nije pronađen u eventu!");
      return res.status(400).send("Bad Request: callId nedostaje");
    }

    console.log(`📞 Poziv ${callId} je počeo. Startujem timer za 120 sekundi.`);

    // Pokreni timer
    setTimeout(async () => {
      console.log(`⏰ Vreme isteklo za poziv ${callId}. Pokrećem transfer...`);

      try {
        const response = await fetch("https://api.vapi.ai/call/transfer", {
          method: "POST",
          headers: {
            "Authorization": `Bearer 5e83bb86-06fe-4dc2-80ed-05800f510ad7`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            callId: callId,
            destinations: [
              {
                type: "number",
                number: "+381637473108"
              }
            ]
          })
        });

        const result = await response.json();
        console.log("✅ Transfer odgovor:", result);
      } catch (error) {
        console.error("❌ Greška prilikom transfera:", error.message);
      }
    }, 120 * 1000);
  }

  res.status(200).send({ ok: true });
});

app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Transfer Server je aktivan!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server pokrenut na http://localhost:${PORT}`);
});
