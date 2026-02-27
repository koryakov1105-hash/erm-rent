import express, { Request, Response } from 'express';
import multer from 'multer';
import { dbGet, dbInsert } from '../database/init';
import { parseStatement, getFormatFromFilename, ParsedStatementRow } from '../integrations/bank/parseStatement';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname || '').toLowerCase();
    if (ext.endsWith('.xml') || ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Допустимые форматы: .xml, .xlsx, .xls'));
    }
  }
});

// POST /api/integrations/bank/upload — загрузка выписки (файл + bank_account_id обязателен)
router.post('/bank/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = (req as any).file;
    const bankAccountId = req.body?.bank_account_id != null ? parseInt(String(req.body.bank_account_id), 10) : null;
    const formatOverride = req.body?.format as string | undefined;

    if (!file || !file.buffer) {
      return res.status(400).json({ error: 'Файл не загружен. Выберите файл выписки (.xml или .xlsx).' });
    }
    if (bankAccountId == null || isNaN(bankAccountId)) {
      return res.status(400).json({ error: 'Укажите банковский счёт (bank_account_id).' });
    }

    const account = dbGet('bank_accounts', bankAccountId);
    if (!account) {
      return res.status(400).json({ error: 'Указанный банковский счёт не найден.' });
    }

    const format = formatOverride === 'xml' || formatOverride === 'xlsx'
      ? formatOverride
      : getFormatFromFilename(file.originalname || '');
    if (!format) {
      return res.status(400).json({ error: 'Формат файла не поддерживается. Используйте .xml, .xlsx или .xls' });
    }

    let rows: ParsedStatementRow[];
    try {
      rows = parseStatement(Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer), format);
    } catch (err: any) {
      console.error('Parse statement error:', err);
      return res.status(400).json({
        error: 'Ошибка разбора файла выписки.',
        details: err?.message || String(err)
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'В файле не найдено ни одной операции. Проверьте формат и заголовки.' });
    }

    const created: any[] = [];
    for (const row of rows) {
      const type = row.amount >= 0 ? 'income' : 'expense';
      const amount = Math.abs(row.amount);
      const description = [row.description, row.counterparty].filter(Boolean).join(' — ') || null;
      const transaction = dbInsert('transactions', {
        type,
        amount,
        date: row.date,
        description,
        payer: row.counterparty || null,
        is_planned: 0,
        status: 'paid',
        bank_account_id: bankAccountId,
        unit_id: null,
        property_id: null,
        lease_id: null,
        category: null,
        category_detail: null,
        is_tenant_payment: 0,
        related_payment_id: null,
        scheduled_pay_date: null
      });
      created.push(transaction);
    }

    res.status(201).json({ created: created.length, transactions: created });
  } catch (error: any) {
    console.error('Bank upload error:', error);
    res.status(500).json({
      error: 'Ошибка при импорте выписки.',
      details: error?.message || String(error)
    });
  }
});

export default router;
