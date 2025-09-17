// server.js
const express = require('express');
const app = express();

app.use(express.json());

// Webhook endpoint
app.post('/vapi-webhook', async (req, res) => {
  const request = req.body;

  console.log('📡 [WEBHOOK]', request.type);

  // ✅ Ako Vapi traži destinaciju za transfer
  if (request.type === 'transfer-destination-request') {
    console.log('🔀 [TRANSFER REQUEST] Sending dynamic destination...');

    return res.json({
      destination: {
        type: "number",
        number: "+381637473108",
        message: "Ćao {{firstName}}, da ti ne dužim — mislim da će ti moj kolega Ilija reći sve što ti treba mnogo bolje. Sad ću te prebaciti na njega."
      }
    });
  }

  // ✅ Ako je poziv počeo — NE reagujemo više ovde
  // Jer tool mora da se aktivira iz asistenta, ne iz backenda

  res.status(200).send('OK');
});

// Health check
app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Transfer Server is running!');
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ [SERVER] Running on port ${PORT}`);
});