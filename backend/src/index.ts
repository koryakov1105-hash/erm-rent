import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase, getDataFilePath } from './database/init';
import authRoutes from './routes/auth';
import propertiesRoutes from './routes/properties';
import unitsRoutes from './routes/units';
import tenantsRoutes from './routes/tenants';
import leasesRoutes from './routes/leases';
import mandatoryPaymentsRoutes from './routes/mandatory-payments';
import actualMandatoryPaymentsRoutes from './routes/actual-mandatory-payments';
import tenantPaymentsRoutes from './routes/tenant-payments';
import transactionsRoutes from './routes/transactions';
import addressSuggestRoutes from './routes/address-suggest';
import invoicesRoutes from './routes/invoices';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Content Security Policy для защиты от нежелательных внешних скриптов
app.use((req, res, next) => {
  // CSP заголовок для статических файлов и HTML
  if (!req.path.startsWith('/api')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://suggestions.dadata.ru;"
    );
  }
  next();
});

// Routes (auth без обязательного токена)
app.use('/api/auth', authRoutes);
// API (можно позже защитить authMiddleware)
app.use('/api/properties', propertiesRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/leases', leasesRoutes);
app.use('/api/mandatory-payments', mandatoryPaymentsRoutes);
app.use('/api/actual-mandatory-payments', actualMandatoryPaymentsRoutes);
app.use('/api/tenant-payments', tenantPaymentsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/address-suggest', addressSuggestRoutes);
app.use('/api/invoices', invoicesRoutes);

// В production: раздача собранного фронта из backend/public (если папка есть)
const publicDir = path.join(__dirname, '..', 'public');
const hasPublic = fs.existsSync(publicDir);

// Убираем 404 для favicon.ico: отдаём favicon.svg с нужным типом
app.get('/favicon.ico', (req, res) => {
  const svgPath = path.join(publicDir, 'favicon.svg');
  if (hasPublic && fs.existsSync(svgPath)) {
    res.type('image/svg+xml');
    res.sendFile(svgPath);
  } else {
    res.status(204).end();
  }
});

if (process.env.NODE_ENV === 'production' && hasPublic) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  // Режим разработки или без public: корень — JSON
  app.get('/', (req, res) => {
    res.json({
      name: 'ERP Rent API',
      version: '1.0',
      message: 'API доступен по префиксу /api. Проверка: GET /api/health',
      health: '/api/health',
      docs: 'Используйте фронтенд (порт 3000) или запросы к /api/*',
    });
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ERP Rent System API is running' });
});

// Отладка: путь к БД — только не в production
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/debug-db', (req, res) => {
    try {
      res.json({ dataFile: getDataFilePath() });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });
}

// Любой другой путь под /api — явный 404 JSON (вместо "Cannot GET")
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Любой другой путь в корне (если не SPA fallback)
if (!(process.env.NODE_ENV === 'production' && hasPublic)) {
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.path,
      hint: 'API: /api/health, /api/properties, ... Фронтенд обычно на порту 3000.',
    });
  });
}

// Initialize database and start server
const HOST = process.env.HOST || '0.0.0.0';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'erm-rent-secret-change-in-production')) {
  console.warn('⚠️  В production задайте надёжный JWT_SECRET в переменных окружения.');
}
try {
  initializeDatabase();
  app.listen(Number(PORT), HOST, () => {
    console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
  });
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}
