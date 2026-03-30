import express, { Request, Response } from 'express';
import { dbAll } from '../database/init';

const router = express.Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const alerts: { level: 'warning' | 'danger' | 'info'; code: string; message: string }[] = [];

    const tenantPayments = dbAll('tenant_payments') as any[];
    for (const tp of tenantPayments) {
      if (!tp || tp.is_paid === 1) continue;
      const lastDay = new Date(tp.year, tp.month, 0).getDate();
      const periodEnd = new Date(tp.year, tp.month - 1, lastDay, 23, 59, 59);
      if (now > periodEnd) {
        alerts.push({
          level: 'danger',
          code: 'tenant_payment_overdue',
          message: `Просрочен арендный платёж (юнит ${tp.unit_id}, ${tp.month}/${tp.year})`,
        });
      }
    }

    const leases = dbAll('leases') as any[];
    const in60 = new Date();
    in60.setDate(in60.getDate() + 60);
    for (const l of leases) {
      if (!l || l.status !== 'active' || !l.end_date) continue;
      const end = new Date(l.end_date);
      if (end <= in60 && end >= now) {
        alerts.push({
          level: 'warning',
          code: 'lease_ending',
          message: `Договор ${l.id} завершается ${l.end_date}`,
        });
      }
    }

    const txs = dbAll('transactions') as any[];
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59);
    const inMonth = (t: any) => {
      if (!t?.date) return false;
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    };
    let plannedIncome = 0;
    let plannedExpense = 0;
    let actualIncome = 0;
    let actualExpense = 0;
    for (const t of txs) {
      if (!inMonth(t)) continue;
      const amt = Number(t.amount) || 0;
      if (t.is_planned === 1) {
        if (t.type === 'income') plannedIncome += amt;
        else plannedExpense += amt;
      } else {
        if (t.type === 'income') actualIncome += amt;
        else actualExpense += amt;
      }
    }
    const plannedNet = plannedIncome - plannedExpense;
    const actualNet = actualIncome - actualExpense;
    if (plannedNet > 0 && actualNet < 0) {
      alerts.push({
        level: 'danger',
        code: 'negative_actual_cash_month',
        message: `По факту за текущий месяц отрицательный поток ( ${actualNet.toFixed(0)} ₽ при плане ${plannedNet.toFixed(0)} ₽)`,
      });
    } else if (plannedIncome > 0 && actualIncome < plannedIncome * 0.9) {
      alerts.push({
        level: 'warning',
        code: 'income_below_plan',
        message: `Фактические доходы за месяц отстают от плана более чем на 10%`,
      });
    }

    const deviations = {
      month: m,
      year: y,
      planned_income: plannedIncome,
      planned_expense: plannedExpense,
      planned_net: plannedNet,
      actual_income: actualIncome,
      actual_expense: actualExpense,
      actual_net: actualNet,
      income_gap_pct: plannedIncome > 0 ? Math.round(((actualIncome - plannedIncome) / plannedIncome) * 1000) / 10 : null,
    };

    res.setHeader('Cache-Control', 'no-store');
    res.json({ alerts, deviations });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to compute insights' });
  }
});

export default router;
