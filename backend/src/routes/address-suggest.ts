import express, { Request, Response } from 'express';

const router = express.Router();
const DADATA_API_KEY = process.env.DADATA_API_KEY || '';
const DADATA_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';

export interface DadataSuggestion {
  value: string;
  unrestricted_value: string;
  data?: Record<string, unknown>;
}

// GET /api/address-suggest?q=москва ленина — подсказки адресов РФ (через Dadata)
router.get('/', async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const count = Math.min(20, Math.max(1, parseInt(String(req.query.count), 10) || 10));

    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    if (!DADATA_API_KEY) {
      console.warn('DADATA_API_KEY not set — address suggestions disabled');
      return res.json({ suggestions: [], hint: 'DADATA_API_KEY not set' });
    }

    const response = await fetch(DADATA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${DADATA_API_KEY}`,
      },
      body: JSON.stringify({ query: q, count }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Dadata API error:', response.status, text);
      return res.status(502).json({ error: 'Address service unavailable', suggestions: [] });
    }

    const data = (await response.json()) as { suggestions?: DadataSuggestion[] };
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    res.json({ suggestions });
  } catch (error) {
    console.error('Error fetching address suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions', suggestions: [] });
  }
});

export default router;
