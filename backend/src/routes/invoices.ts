import express, { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import { dbAll, dbGet, dbQuery } from '../database/init';

const router = express.Router();

// Настройка email транспорта (можно настроить через .env)
const createTransporter = () => {
  // Для разработки используем тестовый аккаунт Ethereal Email
  // В production нужно настроить реальный SMTP сервер
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // Тестовый транспортер (для разработки)
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'test@ethereal.email',
      pass: 'test',
    },
  });
};

// Генерация HTML шаблона счета
function generateInvoiceHTML(data: {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone?: string;
  tenantTaxId?: string;
  propertyName: string;
  unitNumber: string;
  monthlyRent: number;
  period: string;
  companyName?: string;
  companyAddress?: string;
  companyTaxId?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Счет на оплату №${data.invoiceNumber}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #333;
      line-height: 1.6;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border: 1px solid #ddd;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #00311F;
    }
    .company-info {
      flex: 1;
    }
    .invoice-info {
      text-align: right;
    }
    h1 {
      color: #00311F;
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    h2 {
      color: #EC5E27;
      margin: 0 0 20px 0;
      font-size: 20px;
    }
    .invoice-number {
      font-size: 18px;
      font-weight: bold;
      color: #00311F;
      margin-bottom: 5px;
    }
    .invoice-date {
      color: #666;
      font-size: 14px;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-weight: bold;
      color: #00311F;
      margin-bottom: 10px;
      font-size: 14px;
      text-transform: uppercase;
    }
    .bill-to {
      background: #f5f7fa;
      padding: 15px;
      border-radius: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    table th {
      background: #00311F;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    table td {
      padding: 12px;
      border-bottom: 1px solid #ddd;
    }
    table tr:last-child td {
      border-bottom: none;
    }
    .total-row {
      background: #f5f7fa;
      font-weight: bold;
      font-size: 16px;
    }
    .total-row td {
      padding: 15px 12px;
    }
    .amount {
      text-align: right;
      font-size: 18px;
      color: #00311F;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .payment-info {
      background: #fff3e0;
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        <h1>${data.companyName || 'ERP Квадрат'}</h1>
        ${data.companyAddress ? `<p>${data.companyAddress}</p>` : ''}
        ${data.companyTaxId ? `<p>ИНН: ${data.companyTaxId}</p>` : ''}
      </div>
      <div class="invoice-info">
        <div class="invoice-number">Счет №${data.invoiceNumber}</div>
        <div class="invoice-date">Дата: ${data.invoiceDate}</div>
        <div class="invoice-date">Срок оплаты: ${data.dueDate}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Плательщик:</div>
      <div class="bill-to">
        <strong>${data.tenantName}</strong><br>
        ${data.tenantEmail ? `Email: ${data.tenantEmail}<br>` : ''}
        ${data.tenantPhone ? `Телефон: ${data.tenantPhone}<br>` : ''}
        ${data.tenantTaxId ? `ИНН: ${data.tenantTaxId}` : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Основание:</div>
      <p>Аренда недвижимости по договору аренды</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>Наименование</th>
          <th>Период</th>
          <th style="text-align: right;">Сумма, ₽</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            Арендная плата за помещение<br>
            <small style="color: #666;">${data.propertyName}, ${data.unitNumber}</small>
          </td>
          <td>${data.period}</td>
          <td style="text-align: right;">${data.monthlyRent.toLocaleString('ru-RU')}</td>
        </tr>
        <tr class="total-row">
          <td colspan="2"><strong>Итого к оплате:</strong></td>
          <td class="amount">${data.monthlyRent.toLocaleString('ru-RU')} ₽</td>
        </tr>
      </tbody>
    </table>

    <div class="payment-info">
      <strong>Реквизиты для оплаты:</strong><br>
      Банк: [Укажите реквизиты банка]<br>
      БИК: [Укажите БИК]<br>
      Расчетный счет: [Укажите расчетный счет]<br>
      Корр. счет: [Укажите корр. счет]<br>
      Назначение платежа: Оплата аренды за ${data.period} по счету №${data.invoiceNumber}
    </div>

    <div class="footer">
      <p>Счет действителен до ${data.dueDate}</p>
      <p>С уважением, ${data.companyName || 'ERP Квадрат'}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Генерация PDF счета (асинхронная)
function generateInvoicePDF(data: {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone?: string;
  tenantTaxId?: string;
  propertyName: string;
  unitNumber: string;
  monthlyRent: number;
  period: string;
  companyName?: string;
  companyAddress?: string;
  companyTaxId?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      // Заголовок
      doc.fontSize(20).fillColor('#00311F').text(data.companyName || 'ERP Квадрат', { align: 'left' });
      doc.moveDown();
      doc.fontSize(16).fillColor('#EC5E27').text(`Счет №${data.invoiceNumber}`, { align: 'right' });
      doc.fontSize(12).fillColor('#666').text(`Дата: ${data.invoiceDate}`, { align: 'right' });
      doc.text(`Срок оплаты: ${data.dueDate}`, { align: 'right' });
      doc.moveDown(2);

      // Плательщик
      doc.fontSize(14).fillColor('#00311F').text('Плательщик:', { underline: true });
      doc.fontSize(12).fillColor('#000').text(data.tenantName);
      if (data.tenantEmail) doc.text(`Email: ${data.tenantEmail}`);
      if (data.tenantPhone) doc.text(`Телефон: ${data.tenantPhone}`);
      if (data.tenantTaxId) doc.text(`ИНН: ${data.tenantTaxId}`);
      doc.moveDown();

      // Основание
      doc.fontSize(14).fillColor('#00311F').text('Основание:', { underline: true });
      doc.fontSize(12).fillColor('#000').text('Аренда недвижимости по договору аренды');
      doc.moveDown();

      // Таблица
      const tableTop = doc.y;
      doc.fontSize(10).fillColor('#FFFFFF');
      doc.rect(50, tableTop, 500, 20).fill('#00311F');
      doc.text('Наименование', 55, tableTop + 5);
      doc.text('Период', 300, tableTop + 5);
      doc.text('Сумма, ₽', 450, tableTop + 5, { align: 'right' });

      doc.fontSize(11).fillColor('#000');
      const rowTop = tableTop + 25;
      doc.text(`Арендная плата за помещение`, 55, rowTop);
      doc.fontSize(9).fillColor('#666').text(`${data.propertyName}, ${data.unitNumber}`, 55, rowTop + 15);
      doc.fontSize(11).fillColor('#000').text(data.period, 300, rowTop);
      doc.text(data.monthlyRent.toLocaleString('ru-RU'), 450, rowTop, { align: 'right' });

      const totalTop = rowTop + 40;
      doc.fontSize(12).fillColor('#000').text('Итого к оплате:', 55, totalTop);
      doc.fontSize(14).fillColor('#00311F').text(`${data.monthlyRent.toLocaleString('ru-RU')} ₽`, 450, totalTop, { align: 'right' });

      doc.moveDown(3);

      // Реквизиты
      doc.fontSize(12).fillColor('#000').text('Реквизиты для оплаты:', { underline: true });
      doc.fontSize(10).text('Банк: [Укажите реквизиты банка]');
      doc.text('БИК: [Укажите БИК]');
      doc.text('Расчетный счет: [Укажите расчетный счет]');
      doc.text('Корр. счет: [Укажите корр. счет]');
      doc.text(`Назначение платежа: Оплата аренды за ${data.period} по счету №${data.invoiceNumber}`);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// POST /api/invoices/generate - генерация и отправка счета
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { leaseId, period, sendEmail } = req.body;

    if (!leaseId) {
      return res.status(400).json({ error: 'Укажите ID договора' });
    }

    // Получаем данные договора
    const lease = dbGet('leases', parseInt(leaseId));
    if (!lease) {
      return res.status(404).json({ error: 'Договор не найден' });
    }

    if (lease.status !== 'active') {
      return res.status(400).json({ error: 'Можно формировать счета только для активных договоров' });
    }

    // Получаем данные арендатора
    const tenant = dbGet('tenants', lease.tenant_id);
    if (!tenant) {
      return res.status(404).json({ error: 'Арендатор не найден' });
    }

    if (sendEmail && !tenant.email) {
      return res.status(400).json({ error: 'У арендатора не указан email для отправки счета' });
    }

    // Получаем данные юнита и объекта
    const unit = dbGet('units', lease.unit_id);
    if (!unit) {
      return res.status(404).json({ error: 'Помещение не найдено' });
    }

    const property = dbGet('properties', unit.property_id);
    if (!property) {
      return res.status(404).json({ error: 'Объект не найден' });
    }

    // Формируем период
    const periodStr = period || (() => {
      const now = new Date();
      const monthNames = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 
                          'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
      return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    })();

    // Генерируем номер счета
    const invoiceNumber = `INV-${lease.id}-${Date.now()}`;
    const invoiceDate = new Date().toLocaleDateString('ru-RU');
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU'); // +14 дней

    const invoiceData = {
      invoiceNumber,
      invoiceDate,
      dueDate,
      tenantName: tenant.name,
      tenantEmail: tenant.email,
      tenantPhone: tenant.phone,
      tenantTaxId: tenant.tax_id,
      propertyName: property.name,
      unitNumber: unit.unit_number,
      monthlyRent: lease.monthly_rent,
      period: periodStr,
      companyName: process.env.COMPANY_NAME || 'ERP Квадрат',
      companyAddress: process.env.COMPANY_ADDRESS,
      companyTaxId: process.env.COMPANY_TAX_ID,
    };

    // Генерируем HTML и PDF
    const htmlContent = generateInvoiceHTML(invoiceData);
    const pdfBuffer = await generateInvoicePDF(invoiceData);

    let emailSent = false;
    let emailError = null;

    // Отправляем email если требуется
    if (sendEmail && tenant.email) {
      try {
        const transporter = createTransporter();
        
        const mailOptions = {
          from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com',
          to: tenant.email,
          subject: `Счет на оплату аренды №${invoiceNumber}`,
          html: htmlContent,
          attachments: [
            {
              filename: `invoice-${invoiceNumber}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        };

        const info = await transporter.sendMail(mailOptions);
        emailSent = true;
        console.log('Email sent:', info.messageId);
      } catch (error: any) {
        console.error('Error sending email:', error);
        emailError = error.message;
        // Не прерываем выполнение, возвращаем счет даже если email не отправился
      }
    }

    res.json({
      success: true,
      invoice: {
        number: invoiceNumber,
        date: invoiceDate,
        dueDate,
        html: htmlContent,
        pdf: pdfBuffer.toString('base64'),
      },
      emailSent,
      emailError,
    });
  } catch (error: any) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      error: 'Ошибка генерации счета',
      detail: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

export default router;
