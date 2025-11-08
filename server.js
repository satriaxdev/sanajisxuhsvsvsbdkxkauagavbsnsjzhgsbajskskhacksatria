/**
 * server.js
 * Simple Express server that proxies requests to Google Generative Language (Gemini)
 * and handles image uploads for analysis. Uses environment variables from .env.
 *
 * NOTE: This file uses safe prompts and placeholders. Fill .env with your real keys.
 */

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const multer = require('multer');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: 'uploads/' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Helper: call Gemini text generate
async function callGeminiText(prompt) {
  if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY in environment');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    "content": [{
      "mimeType": "text/plain",
      "text": prompt
    }],
    "temperature": 0.2,
    "candidateCount": 1
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Backwards-compatible wrapper used by some GL endpoints; if your hosting uses a different schema, adjust accordingly.
      "instances": [{ "input": prompt }]
    })
  });

  // Try to parse generalized response, but different GL versions return different shapes.
  const data = await res.json();
  // Best-effort extraction:
  if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content[0]) {
    return data.candidates[0].content[0].text || JSON.stringify(data);
  }
  // Fallback: return entire JSON
  return JSON.stringify(data);
}

// Endpoint: chat (text)
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Missing message' });

    // Construct a safe system prompt that preserves personality without explicit/illegal content.
    const systemPrompt = `Kamu adalah SatriaCb — asisten AI yang tegas, jujur, cepat, dan ahli di coding, algoritma, matematika, serta desain. Berikan jawaban yang jelas, lengkap, dan (jika perlu) contoh kode. Jangan gunakan bahasa eksplisit, tidak etis, atau instruksi yang mendorong kegiatan ilegal.`;

    const fullPrompt = `${systemPrompt}\n\nPertanyaan pengguna: ${message}`;

    const reply = await callGeminiText(fullPrompt);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Endpoint: generate image (/gambar)
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    // Call Gemini image generation endpoint (v1beta example).
    // Implementation details of Gemini image generation may vary — this is a best-effort example.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody = {
      "content": [{
        "mimeType": "text/plain",
        "text": `Generate an image for the following prompt (return base64 PNG): ${prompt}`
      }],
      "modalities": ["image"]
    };

    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await apiRes.json();
    // Try to extract base64 image if present:
    // This may require adapting to the exact response format of your Gemini plan.
    let imageBase64 = null;
    if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content[0]) {
      const c = data.candidates[0].content[0];
      if (c.image && c.image.imageBytes) {
        imageBase64 = c.image.imageBytes; // already base64
      } else if (c.text) {
        // Some endpoints return a data URL or base64 inside text
        const m = c.text.match(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)/);
        if (m) imageBase64 = m[2];
      }
    }

    if (!imageBase64) {
      // If not found, return the raw response for debugging
      return res.status(502).json({ error: 'No image returned from Gemini', raw: data });
    }

    res.json({ imageBase64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Endpoint: analyze uploaded image
app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing image file' });
    const imgPath = req.file.path;
    const fileData = fs.readFileSync(imgPath);
    const b64 = fileData.toString('base64');

    // Construct a prompt that asks Gemini to analyze the image.
    // Depending on your Gemini access, you may need to send the image bytes differently.
    const prompt = `Analisis gambar (base64 PNG/JPEG). Beri deskripsi singkat dari isi gambar, objek penting, warna dominan, dan kemungkinan konteks penggunaan. Hati-hati terhadap privasi dan jangan berasumsi detail sensitif. Base64: ${b64.slice(0,200)}... (truncated)`;

    const reply = await callGeminiText(prompt);

    // cleanup uploaded file
    fs.unlinkSync(imgPath);

    res.json({ analysis: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Endpoint: send feedback to Telegram (proxy)
app.post('/api/feedback', async (req, res) => {
  try {
    const { name, message } = req.body;
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return res.status(500).json({ error: 'Missing Telegram config' });
    const text = `Nama: ${name || 'Tidak disebutkan'}\nFeedback dari web SatriaCb:\n${message}`;

    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
    });
    const tgJson = await tgRes.json();
    res.json({ ok: tgJson.ok, result: tgJson.result || tgJson });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Fallback: serve index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('SatriaCb server listening on port', port);
});
