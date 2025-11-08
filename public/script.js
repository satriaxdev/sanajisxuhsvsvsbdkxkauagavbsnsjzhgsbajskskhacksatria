/* script.js - frontend that calls backend endpoints for chat, generate image, and analyze image */
const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const imgInput = document.getElementById('imgInput');
const previewBox = document.getElementById('previewBox');
const previewImg = document.getElementById('previewImg');
const removeBtn = document.getElementById('removeBtn');

function addMsg(text, sender='bot', imgSrc=null) {
  const msg = document.createElement('div');
  msg.className = 'msg ' + (sender === 'user' ? 'user' : 'bot');
  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (sender === 'user' ? 'user-bubble' : '');
  bubble.innerHTML = text;
  if (imgSrc) {
    const img = document.createElement('img');
    img.src = imgSrc;
    img.style.maxWidth = '320px';
    img.style.display = 'block';
    img.style.marginTop = '8px';
    bubble.appendChild(img);
  }
  msg.appendChild(bubble);
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendChat(message) {
  addMsg(message, 'user');
  // If command is /gambar
  if (message.startsWith('/gambar ' ) || message.startsWith('/gamabr ')) {
    const prompt = message.replace(/^\/gamb?ar\s*/i, '').trim();
    addMsg('🖼️ Sedang membuat gambar...', 'bot');
    try {
      const resp = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await resp.json();
      // Remove the "Sedang membuat gambar..." message by re-rendering last bot bubble (simple approach)
      if (data.imageBase64) {
        const dataUrl = 'data:image/png;base64,' + data.imageBase64;
        addMsg('Berikut hasil gambarnya:', 'bot', dataUrl);
      } else if (data.raw) {
        addMsg('Gagal membuat gambar, server merespon: ' + (data.error || 'no image'), 'bot');
        console.log('raw response', data.raw);
      } else {
        addMsg('Gagal membuat gambar: ' + (data.error || 'unknown'), 'bot');
      }
    } catch (e) {
      addMsg('Terjadi kesalahan saat membuat gambar.', 'bot');
      console.error(e);
    }
    return;
  }

  // Regular chat
  addMsg('SatriaCb sedang mengetik...', 'bot');
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await resp.json();
    if (data.reply) {
      addMsg(data.reply, 'bot');
    } else {
      addMsg('Maaf, tidak ada balasan dari server.', 'bot');
    }
  } catch (e) {
    addMsg('Terjadi kesalahan koneksi ke server.', 'bot');
    console.error(e);
  }
}

sendBtn.addEventListener('click', () => {
  const txt = userInput.value.trim();
  if (!txt) return;
  userInput.value = '';
  sendChat(txt);
});
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendBtn.click();
  }
});

// Image upload for analysis
imgInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  previewImg.src = URL.createObjectURL(file);
  previewBox.style.display = 'flex';
  // automatically send for analysis
  addMsg('📷 Mengirim gambar untuk dianalisis...', 'bot');
  const form = new FormData();
  form.append('image', file);
  try {
    const resp = await fetch('/api/analyze-image', { method: 'POST', body: form });
    const data = await resp.json();
    if (data.analysis) {
      addMsg(data.analysis, 'bot');
    } else {
      addMsg('Analisis gagal: ' + (data.error || 'no response'), 'bot');
    }
  } catch (err) {
    addMsg('Terjadi kesalahan saat mengirim gambar.', 'bot');
    console.error(err);
  }
});

removeBtn.addEventListener('click', () => {
  previewBox.style.display = 'none';
  previewImg.src = '';
  imgInput.value = '';
});
