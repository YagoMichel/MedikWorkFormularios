import { Router } from 'express';
import { processMessage } from '../services/agentService';
import { sendWhatsAppMessage } from '../services/whatsappService';

const router = Router();
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'cambia-esto-por-secreto';

// GET — verificacion del webhook por Meta
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// POST — mensajes entrantes
router.post('/webhook', async (req, res) => {
  // Responder rapido a Meta para que no reintente
  res.sendStatus(200);
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    if (!message || message.type !== 'text') return;
    const from = message.from as string;
    const text = message.text?.body as string;
    if (!from || !text) return;

    const reply = await processMessage('whatsapp', from, text);
    await sendWhatsAppMessage(from, reply);
  } catch (err) {
    console.error('[WhatsApp webhook] error:', err);
  }
});

export default router;
