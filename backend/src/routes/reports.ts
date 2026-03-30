import express, { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { dbAll } from '../database/init';
import { getLedgerRowForTransaction } from '../lib/ledgerResolve';

const router = express.Router();

function parseDate(s: string): Date {
  return new Date(s.includes('T') ? s : `${s}T12:00:00`);
}

function collectTransactions(
  start_date?: string,
  end_date?: string,
  property_id?: string,
  actualOnly = true
): any[] {
  let txs = dbAll('transactions') as any[];
  if (actualOnly) txs = txs.filter((t) => t && t.is_planned === 0);
  if (property_id) {
    const pid = parseInt(property_id, 10);
    txs = txs.filter((t) => t.property_id === pid);
  }
  if (start_date || end_date) {
    txs = txs.filter((t) => {
      if (!t.date) return false;
      const d = parseDate(String(t.date));
      if (isNaN(d.getTime())) return false;
      if (start_date && d < parseDate(start_date as string)) return false;
      if (end_date && d > parseDate(end_date as string)) return false;
      return true;
    });
  }
  return txs;
}

/** Управленческий отчёт о движении денежных средств (упрощённо по фактическим операциям). */
router.get('/cash-flow', (req: Request, res: Response) => {
  try {
    const { start_date, end_date, property_id } = req.query;
    const txs = collectTransactions(start_date as string, end_date as string, property_id as string, true);
    const byActivity: Record<string, { name: string; inflow: number; outflow: number }> = {};
    const ensure = (key: string, name: string) => {
      if (!byActivity[key]) byActivity[key] = { name, inflow: 0, outflow: 0 };
    };
    for (const t of txs) {
      const row = getLedgerRowForTransaction(t);
      const act = row?.cfs_activity || 'operating';
      const label =
        act === 'investing'
          ? 'Инвестиционная деятельность'
          : act === 'financing'
            ? 'Финансовая деятельность'
            : 'Операционная деятельность';
      ensure(act, label);
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') byActivity[act].inflow += amt;
      else byActivity[act].outflow += amt;
    }
    const sections = ['operating', 'investing', 'financing'].map((k) => {
      const b = byActivity[k] || { name: k, inflow: 0, outflow: 0 };
      const net = b.inflow - b.outflow;
      return { activity: k, label: b.name, inflow: b.inflow, outflow: b.outflow, net };
    });
    const totalNet = sections.reduce((s, x) => s + x.net, 0);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      period: { start_date: start_date || null, end_date: end_date || null },
      sections,
      total_net_cash_flow: totalNet,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to build cash flow report' });
  }
});

/** Управленческий отчёт о прибылях и убытках (по статьям pl_group). */
router.get('/profit-loss', (req: Request, res: Response) => {
  try {
    const { start_date, end_date, property_id } = req.query;
    const txs = collectTransactions(start_date as string, end_date as string, property_id as string, true);
    const byGroup: Record<string, { label: string; amount: number }> = {
      revenue: { label: 'Выручка', amount: 0 },
      direct_cost: { label: 'Прямые расходы', amount: 0 },
      operating_expense: { label: 'Операционные расходы', amount: 0 },
      other: { label: 'Прочее', amount: 0 },
    };
    for (const t of txs) {
      const row = getLedgerRowForTransaction(t);
      const g = row?.pl_group || (t.type === 'income' ? 'revenue' : 'operating_expense');
      const key = byGroup[g] ? g : 'other';
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') byGroup[key].amount += amt;
      else byGroup[key].amount -= amt;
    }
    const revenue = byGroup.revenue.amount;
    const expenses = -(byGroup.direct_cost.amount + byGroup.operating_expense.amount + byGroup.other.amount);
    const lines = [
      { key: 'revenue', ...byGroup.revenue },
      { key: 'direct_cost', ...byGroup.direct_cost },
      { key: 'operating_expense', ...byGroup.operating_expense },
      { key: 'other', ...byGroup.other },
    ];
    const netIncome =
      byGroup.revenue.amount + byGroup.direct_cost.amount + byGroup.operating_expense.amount + byGroup.other.amount;
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      period: { start_date: start_date || null, end_date: end_date || null },
      lines,
      revenue_total: revenue,
      expense_total: expenses,
      net_income: netIncome,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to build P&L report' });
  }
});

/** Упрощённый баланс: «деньги» = чистый денежный поток за всё время до end_date (без запасов/ОС). */
router.get('/balance-simple', (req: Request, res: Response) => {
  try {
    const { end_date, property_id } = req.query;
    const txs = collectTransactions(undefined, end_date as string, property_id as string, true);
    let cash = 0;
    for (const t of txs) {
      const amt = Number(t.amount) || 0;
      cash += t.type === 'income' ? amt : -amt;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      as_of: end_date || null,
      assets: [{ line: 'Денежные средства (упрощённо)', amount: cash }],
      liabilities: [],
      equity: [{ line: 'Итого', amount: cash }],
      note: 'Упрощённая форма без учёта основных средств и обязательств; для управленческого обзора.',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to build balance' });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const type = String(req.query.type || 'cash_flow').toLowerCase();
    const { start_date, end_date, property_id } = req.query;

    if (format !== 'xlsx' && format !== 'pdf') {
      return res.status(400).json({ error: 'format: xlsx | pdf' });
    }

    const txs = collectTransactions(start_date as string, end_date as string, property_id as string, true);

    if (type === 'cash_flow') {
      const byActivity: Record<string, { label: string; inflow: number; outflow: number }> = {};
      const labelFor = (act: string) =>
        act === 'investing'
          ? 'Инвестиционная'
          : act === 'financing'
            ? 'Финансовая'
            : 'Операционная';
      for (const t of txs) {
        const row = getLedgerRowForTransaction(t);
        const act = row?.cfs_activity || 'operating';
        if (!byActivity[act]) byActivity[act] = { label: labelFor(act), inflow: 0, outflow: 0 };
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') byActivity[act].inflow += amt;
        else byActivity[act].outflow += amt;
      }
      const rows = Object.entries(byActivity).map(([k, v]) => ({
        Вид: v.label,
        Приток: v.inflow,
        Отток: v.outflow,
        Чистый: v.inflow - v.outflow,
      }));

      if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ДДС');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="cash-flow.xlsx"');
        res.send(buf);
        return;
      }

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="cash-flow.pdf"');
      doc.pipe(res);
      doc.fontSize(14).text('Отчёт о движении денежных средств', { underline: true });
      doc.moveDown();
      doc.fontSize(10).text(`Период: ${start_date || '…'} — ${end_date || '…'}`);
      doc.moveDown();
      rows.forEach((r) => {
        doc.text(`${r.Вид}: приток ${r.Приток} / отток ${r.Отток} / чистый ${r.Чистый}`);
      });
      doc.end();
      return;
    }

    if (type === 'profit_loss') {
      const groups: Record<string, number> = {
        revenue: 0,
        direct_cost: 0,
        operating_expense: 0,
        other: 0,
      };
      for (const t of txs) {
        const row = getLedgerRowForTransaction(t);
        const g = row?.pl_group || (t.type === 'income' ? 'revenue' : 'operating_expense');
        const key = groups[g] !== undefined ? g : 'other';
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') groups[key] += amt;
        else groups[key] -= amt;
      }
      const rows = [
        { Статья: 'Выручка', Сумма: groups.revenue },
        { Статья: 'Прямые расходы', Сумма: groups.direct_cost },
        { Статья: 'Операционные расходы', Сумма: groups.operating_expense },
        { Статья: 'Прочее', Сумма: groups.other },
        {
          Статья: 'Чистая прибыль',
          Сумма: groups.revenue + groups.direct_cost + groups.operating_expense + groups.other,
        },
      ];
      if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ОПиУ');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="profit-loss.xlsx"');
        res.send(buf);
        return;
      }
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="profit-loss.pdf"');
      doc.pipe(res);
      doc.fontSize(14).text('Отчёт о прибылях и убытках (управленческий)', { underline: true });
      doc.moveDown();
      doc.fontSize(10).text(`Период: ${start_date || '…'} — ${end_date || '…'}`);
      doc.moveDown();
      rows.forEach((r) => doc.text(`${r.Статья}: ${r.Сумма}`));
      doc.end();
      return;
    }

    return res.status(400).json({ error: 'type: cash_flow | profit_loss' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;
