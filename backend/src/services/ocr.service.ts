import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

export interface ExtractedRx {
  odSph?: number; odCyl?: number; odAxis?: number; odAdd?: number;
  oiSph?: number; oiCyl?: number; oiAxis?: number; oiAdd?: number;
  dpOd?: number; dpOi?: number; dpBin?: number;
  diagnosis?: string;
  _simulated?: boolean;
  _note?: string;
}

const PROMPT = `Eres un asistente que extrae los valores de una receta visual oftálmica desde la imagen.
Devuelve SOLO un JSON con las llaves: odSph, odCyl, odAxis, odAdd, oiSph, oiCyl, oiAxis, oiAdd, dpOd, dpOi, dpBin, diagnosis.
Usa números (decimales con punto). Si un campo no aparece, omítelo. No incluyas texto extra fuera del JSON.`;

export async function extractPrescriptionFromImage(base64: string, mediaType: string): Promise<ExtractedRx> {
  if (!client) {
    return {
      odSph: -1.25, odCyl: -0.50, odAxis: 90,
      oiSph: -1.00, oiCyl: -0.75, oiAxis: 85,
      dpBin: 62,
      diagnosis: 'Miopía con astigmatismo leve (simulado - configura ANTHROPIC_API_KEY)',
      _simulated: true,
      _note: 'OCR simulado: configura ANTHROPIC_API_KEY para usar IA real',
    };
  }
  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });
    const text = resp.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]);
  } catch (e: any) {
    return { _simulated: true, _note: 'Error OCR: ' + e.message };
  }
}
