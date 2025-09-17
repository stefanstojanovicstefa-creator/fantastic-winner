// server.js
const express = require('express');
const app = express();

app.use(express.json());

app.post('/vapi-webhook', async (req, res) => {
  // 🔥 LOGUJEMO CEO BODY DA VIDIMO STA VAPI SALJE
  console.log('📡 [RAW BODY]', JSON.stringify(req.body, null, 2));

  // ✅ POKUSAVAMO DA PROCITAMO TYPE IZ RAZLICITIH MESTA
  const eventType = req.body?.type || req.body?.message?.type;

  console.log('📡 [WEBHOOK TYPE]', eventType);

  // ✅ Ako Vapi trazi destinaciju za transfer
  if (eventType === 'transfer-destination-request') {
    console.log('🔀 [TRANSFER REQUEST] Sending dynamic destination...');

    return res.json({
      destination: {
        type: "number",
        number: "+381637473108",
        message: "Ćao {{firstName}}, da ti ne dužim — mislim da će ti moj kolega Ilija reći sve što ti treba mnogo bolje. Sad ću te prebaciti na njega."
      }
    });
  }

  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.status(200).send('🚀 Vapi Transfer Server is running!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ [SERVER] Running on port ${PORT}`);
});