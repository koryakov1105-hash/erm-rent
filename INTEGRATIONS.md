# Интеграции с 1С и банками

Этот документ описывает, как настроить интеграцию ERP квадрат с системами 1С и банками для автоматического отслеживания транзакций.

---

## 📋 Содержание

1. [Общие принципы интеграций](#общие-принципы-интеграций)
2. [Интеграция с банками](#интеграция-с-банками)
3. [Интеграция с 1С](#интеграция-с-1с)
4. [Архитектура решения](#архитектура-решения)
5. [Пошаговая реализация](#пошаговая-реализация)

---

## 🔄 Общие принципы интеграций

### Зачем нужны интеграции?

- **Автоматизация учета** — исключение ручного ввода транзакций
- **Снижение ошибок** — данные приходят напрямую из источников
- **Экономия времени** — не нужно вручную заносить каждую операцию
- **Актуальность данных** — информация всегда свежая

### Типы интеграций

1. **Импорт файлов** (CSV, Excel, XML) — загрузка выписок из банков
2. **API интеграция** — прямое подключение к банковским API
3. **Обмен данными с 1С** — синхронизация через файлы или веб-сервисы

---

## 🏦 Интеграция с банками

### Вариант 1: Импорт выписок (CSV/Excel)

**Самый простой способ для начала.**

#### Как это работает:

1. Пользователь скачивает выписку из интернет-банка (CSV или Excel)
2. Загружает файл в систему ERP квадрат
3. Система парсит файл и извлекает транзакции
4. Пользователь сопоставляет транзакции с платежами/объектами
5. Транзакции автоматически создаются в системе

#### Формат выписки (пример CSV):

```csv
Дата,Сумма,Описание,Контрагент,Номер счета
2026-02-15,50000.00,Арендная плата,ООО "Арендатор 1",40817810099910004312
2026-02-16,-5000.00,Коммунальные услуги,ООО "УК",40817810099910004312
```

#### Что нужно реализовать:

**Backend:**
- Endpoint для загрузки файла: `POST /api/integrations/bank/upload`
- Парсер CSV/Excel файлов
- Валидация данных
- Сохранение импортированных транзакций

**Frontend:**
- Страница "Импорт транзакций"
- Компонент загрузки файла (drag & drop)
- Таблица предпросмотра транзакций перед импортом
- Возможность сопоставления транзакций с платежами

#### Пример кода парсера CSV:

```typescript
// backend/src/integrations/bank/csv-parser.ts
import csv from 'csv-parser';
import fs from 'fs';

export interface BankTransaction {
  date: string;
  amount: number;
  description: string;
  counterparty?: string;
  account?: string;
}

export function parseCSV(filePath: string): Promise<BankTransaction[]> {
  return new Promise((resolve, reject) => {
    const results: BankTransaction[] = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        // Преобразуем данные из CSV в нужный формат
        results.push({
          date: row['Дата'] || row['Date'],
          amount: parseFloat(row['Сумма'] || row['Amount']),
          description: row['Описание'] || row['Description'],
          counterparty: row['Контрагент'] || row['Counterparty'],
          account: row['Номер счета'] || row['Account']
        });
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}
```

---

### Вариант 2: API интеграция с банками

**Более сложный, но автоматический способ.**

#### Поддерживаемые банки в России:

1. **Тинькофф Бизнес API**
   - Документация: https://www.tinkoff.ru/kassa/develop/api/
   - Требуется регистрация в Тинькофф Бизнес
   - OAuth 2.0 авторизация

2. **Сбербанк Бизнес Онлайн API**
   - Документация: https://developer.sberbank.ru/
   - Требуется подключение к Сбербанк Бизнес Онлайн
   - API ключи

3. **Альфа-Банк API**
   - Документация: https://developer.alfabank.ru/
   - Требуется регистрация разработчика

4. **ВТБ API**
   - Документация: https://api.vtb.ru/
   - Требуется регистрация

#### Как это работает:

1. Пользователь подключает банковский счет в настройках
2. Система получает токен доступа (OAuth или API ключ)
3. Периодически (раз в час/день) система запрашивает новые транзакции
4. Транзакции автоматически сопоставляются с платежами
5. Пользователь подтверждает или корректирует сопоставление

#### Архитектура:

```
[Банк API] 
    ↓ (OAuth/API Key)
[ERP Backend] → [Парсер транзакций] → [Сопоставление] → [База данных]
```

#### Пример интеграции с Тинькофф API:

```typescript
// backend/src/integrations/bank/tinkoff.ts
import axios from 'axios';

interface TinkoffConfig {
  apiKey: string;
  terminalKey: string;
}

export class TinkoffIntegration {
  private apiKey: string;
  private terminalKey: string;
  private baseURL = 'https://securepay.tinkoff.ru/v2';

  constructor(config: TinkoffConfig) {
    this.apiKey = config.apiKey;
    this.terminalKey = config.terminalKey;
  }

  async getTransactions(startDate: string, endDate: string) {
    // Получение транзакций через API Тинькофф
    // Требуется реализация согласно документации банка
  }
}
```

#### Что нужно реализовать:

**Backend:**
- Модуль интеграций: `backend/src/integrations/bank/`
- Хранение настроек подключений к банкам
- Периодические задачи (cron jobs) для синхронизации
- Endpoints:
  - `POST /api/integrations/bank/connect` — подключить банк
  - `GET /api/integrations/bank/accounts` — список счетов
  - `POST /api/integrations/bank/sync` — синхронизировать транзакции
  - `GET /api/integrations/bank/transactions` — список импортированных транзакций

**Frontend:**
- Страница "Интеграции" в настройках
- Форма подключения банка (ввод API ключей)
- Список подключенных банков
- Кнопка "Синхронизировать"
- Лог синхронизаций

---

## 📊 Интеграция с 1С

### Вариант 1: Обмен через файлы (XML/JSON)

**Самый простой способ для начала.**

#### Формат обмена данными:

**1С → ERP квадрат (экспорт из 1С):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<DataExchange>
  <Properties>
    <Property id="1" name="Торговый центр" address="г. Москва, ул. Ленина, 10"/>
  </Properties>
  <Units>
    <Unit id="1" property_id="1" number="101" area="50" price_per_sqm="1000"/>
  </Units>
  <Tenants>
    <Tenant id="1" name="ООО Арендатор" email="tenant@example.com" phone="+79991234567"/>
  </Tenants>
  <Transactions>
    <Transaction date="2026-02-15" amount="50000" type="income" description="Арендная плата"/>
  </Transactions>
</DataExchange>
```

**ERP квадрат → 1С (импорт в 1С):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<DataExchange>
  <Transactions>
    <Transaction date="2026-02-15" amount="50000" type="income" unit_id="1" tenant_id="1"/>
  </Transactions>
  <Reports>
    <Report period="2026-02" total_income="500000" total_expenses="50000"/>
  </Reports>
</DataExchange>
```

#### Что нужно реализовать:

**Backend:**
- Endpoint экспорта: `GET /api/integrations/1c/export`
- Endpoint импорта: `POST /api/integrations/1c/import`
- Парсер XML/JSON
- Валидация данных

**Frontend:**
- Страница "Интеграция с 1С"
- Кнопка "Экспорт в 1С" (скачивание XML)
- Загрузка файла из 1С

---

### Вариант 2: Веб-сервисы (SOAP/REST)

**Более продвинутый способ с автоматической синхронизацией.**

#### Как это работает:

1. В 1С создается веб-сервис (публикация HTTP сервиса)
2. ERP квадрат периодически вызывает методы веб-сервиса
3. 1С возвращает данные в формате JSON/XML
4. ERP квадрат обрабатывает данные и синхронизирует

#### Пример веб-сервиса в 1С:

```bsl
// В конфигурации 1С создается HTTP сервис
// Метод: ПолучитьТранзакции

Функция ПолучитьТранзакции(ДатаНачала, ДатаОкончания) Экспорт
    Запрос = Новый Запрос;
    Запрос.Текст = 
    "ВЫБРАТЬ
    |    БанковскиеВыписки.Дата КАК Дата,
    |    БанковскиеВыписки.Сумма КАК Сумма,
    |    БанковскиеВыписки.НазначениеПлатежа КАК Описание
    |ИЗ
    |    Документ.БанковскиеВыписки КАК БанковскиеВыписки
    |ГДЕ
    |    БанковскиеВыписки.Дата МЕЖДУ &ДатаНачала И &ДатаОкончания";
    
    Запрос.УстановитьПараметр("ДатаНачала", ДатаНачала);
    Запрос.УстановитьПараметр("ДатаОкончания", ДатаОкончания);
    
    Результат = Запрос.Выполнить();
    
    Возврат Результат;
КонецФункции
```

#### Интеграция из ERP квадрат:

```typescript
// backend/src/integrations/1c/client.ts
import axios from 'axios';

export class OneCIntegration {
  private baseURL: string;
  private username?: string;
  private password?: string;

  constructor(config: { baseURL: string; username?: string; password?: string }) {
    this.baseURL = config.baseURL;
    this.username = config.username;
    this.password = config.password;
  }

  async getTransactions(startDate: string, endDate: string) {
    const response = await axios.post(
      `${this.baseURL}/hs/erp/getTransactions`,
      { startDate, endDate },
      {
        auth: this.username && this.password
          ? { username: this.username, password: this.password }
          : undefined,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    return response.data;
  }

  async sendTransactions(transactions: any[]) {
    const response = await axios.post(
      `${this.baseURL}/hs/erp/sendTransactions`,
      { transactions },
      {
        auth: this.username && this.password
          ? { username: this.username, password: this.password }
          : undefined,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    return response.data;
  }
}
```

#### Что нужно реализовать:

**Backend:**
- Модуль интеграции с 1С: `backend/src/integrations/1c/`
- Endpoints:
  - `POST /api/integrations/1c/connect` — подключить 1С
  - `POST /api/integrations/1c/sync` — синхронизировать данные
  - `GET /api/integrations/1c/export` — экспорт данных для 1С
  - `POST /api/integrations/1c/import` — импорт данных из 1С

**Frontend:**
- Страница "Интеграция с 1С"
- Настройки подключения (URL, логин, пароль)
- Кнопки синхронизации
- Лог синхронизаций

---

## 🏗️ Архитектура решения

### Структура модуля интеграций:

```
backend/src/integrations/
├── bank/
│   ├── csv-parser.ts          # Парсер CSV файлов
│   ├── excel-parser.ts        # Парсер Excel файлов
│   ├── tinkoff.ts             # Интеграция с Тинькофф
│   ├── sberbank.ts            # Интеграция с Сбербанком
│   └── matcher.ts             # Сопоставление транзакций
├── 1c/
│   ├── client.ts              # Клиент для веб-сервисов 1С
│   ├── xml-parser.ts         # Парсер XML из 1С
│   └── exporter.ts           # Экспорт данных для 1С
└── types.ts                  # Общие типы данных
```

### База данных для интеграций:

```typescript
// Новые таблицы в БД:

// Настройки подключений к банкам
integrations_bank:
  - id
  - name (название банка)
  - type (tinkoff, sberbank, csv_import)
  - config (JSON с настройками: API ключи, токены)
  - is_active
  - last_sync_date
  - created_at

// Импортированные транзакции из банков
bank_transactions:
  - id
  - integration_id (FK)
  - bank_transaction_id (ID транзакции в банке)
  - date
  - amount
  - description
  - counterparty
  - account
  - status (pending, matched, imported, ignored)
  - matched_transaction_id (FK к transactions)
  - created_at

// Настройки подключения к 1С
integrations_1c:
  - id
  - name
  - base_url
  - username
  - password (зашифрован)
  - is_active
  - last_sync_date
  - created_at

// Правила сопоставления транзакций
matching_rules:
  - id
  - name
  - pattern (регулярное выражение для описания)
  - transaction_type (income/expense)
  - category
  - unit_id (опционально)
  - tenant_id (опционально)
  - is_active
```

---

## 🛠️ Пошаговая реализация

### Этап 1: Импорт CSV выписок (MVP)

**Цель:** Реализовать самый простой способ интеграции.

#### Шаг 1.1: Backend — парсер CSV

1. Установить библиотеку для парсинга CSV:
   ```bash
   cd backend
   npm install csv-parser multer
   ```

2. Создать модуль парсера:
   ```typescript
   // backend/src/integrations/bank/csv-parser.ts
   ```

3. Создать endpoint для загрузки:
   ```typescript
   // backend/src/routes/integrations.ts
   router.post('/bank/upload', upload.single('file'), async (req, res) => {
     // Парсинг файла
     // Сохранение транзакций
   });
   ```

#### Шаг 1.2: Frontend — страница импорта

1. Создать страницу `frontend/src/pages/ImportTransactions.tsx`
2. Компонент загрузки файла
3. Таблица предпросмотра транзакций
4. Кнопка "Импортировать"

#### Шаг 1.3: Сопоставление транзакций

1. Алгоритм автоматического сопоставления по сумме и дате
2. Ручное сопоставление пользователем
3. Сохранение правил сопоставления для будущего использования

---

### Этап 2: API интеграция с банками

**Цель:** Автоматическая синхронизация через API.

#### Шаг 2.1: Выбор банка

Начать с одного банка (например, Тинькофф) для MVP.

#### Шаг 2.2: Регистрация в банке

1. Зарегистрироваться в программе для разработчиков банка
2. Получить API ключи
3. Настроить OAuth (если требуется)

#### Шаг 2.3: Реализация клиента

1. Создать класс для работы с API банка
2. Реализовать методы получения транзакций
3. Обработка ошибок и rate limits

#### Шаг 2.4: Периодическая синхронизация

1. Настроить cron job или scheduled task
2. Запускать синхронизацию раз в час/день
3. Логировать результаты

---

### Этап 3: Интеграция с 1С

**Цель:** Обмен данными с 1С.

#### Шаг 3.1: Экспорт данных из ERP квадрат

1. Создать endpoint `/api/integrations/1c/export`
2. Формировать XML/JSON с данными
3. Возможность фильтрации по датам

#### Шаг 3.2: Импорт данных из 1С

1. Создать endpoint `/api/integrations/1c/import`
2. Парсер XML/JSON из 1С
3. Валидация и сохранение данных

#### Шаг 3.3: Веб-сервисы (опционально)

1. Если в 1С есть веб-сервис — создать клиент
2. Реализовать методы синхронизации
3. Настроить периодическую синхронизацию

---

## 🔐 Безопасность

### Важные моменты:

1. **Хранение API ключей:**
   - Никогда не храните ключи в коде
   - Используйте переменные окружения
   - Шифруйте пароли в базе данных

2. **Авторизация:**
   - Используйте HTTPS для всех запросов
   - Проверяйте права доступа пользователя
   - Логируйте все операции интеграций

3. **Валидация данных:**
   - Проверяйте все входящие данные
   - Санитизируйте строки
   - Проверяйте суммы и даты

### Пример хранения настроек:

```typescript
// backend/.env
TINKOFF_API_KEY=your_api_key_here
TINKOFF_TERMINAL_KEY=your_terminal_key_here
ONE_C_BASE_URL=https://1c.example.com
ONE_C_USERNAME=username
ONE_C_PASSWORD=password

// В коде:
const tinkoffConfig = {
  apiKey: process.env.TINKOFF_API_KEY!,
  terminalKey: process.env.TINKOFF_TERMINAL_KEY!
};
```

---

## 📝 Примеры использования

### Пример 1: Импорт CSV выписки

```typescript
// Frontend
const handleFileUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/integrations/bank/upload', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  // Показать предпросмотр транзакций
  setTransactions(data.transactions);
};

// Backend
router.post('/bank/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  const transactions = await parseCSV(file.path);
  
  // Сохранить транзакции как pending
  const saved = transactions.map(t => 
    dbInsert('bank_transactions', {
      ...t,
      status: 'pending',
      integration_id: null
    })
  );
  
  res.json({ transactions: saved });
});
```

### Пример 2: Синхронизация с Тинькофф

```typescript
// Backend cron job (запускается раз в час)
cron.schedule('0 * * * *', async () => {
  const integrations = dbQuery('integrations_bank', 
    (i: any) => i.is_active && i.type === 'tinkoff'
  );
  
  for (const integration of integrations) {
    const client = new TinkoffIntegration(integration.config);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const transactions = await client.getTransactions(
      yesterday.toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    );
    
    // Сохранить транзакции
    for (const txn of transactions) {
      await dbInsert('bank_transactions', {
        integration_id: integration.id,
        bank_transaction_id: txn.id,
        date: txn.date,
        amount: txn.amount,
        description: txn.description,
        status: 'pending'
      });
    }
    
    // Обновить дату последней синхронизации
    dbUpdate('integrations_bank', integration.id, {
      last_sync_date: new Date().toISOString()
    });
  }
});
```

---

## 🎯 Рекомендации по реализации

### Порядок внедрения:

1. **Начните с импорта CSV** — самый простой способ, не требует API
2. **Добавьте автоматическое сопоставление** — по сумме и дате
3. **Реализуйте правила сопоставления** — для автоматизации
4. **Добавьте API интеграцию** — когда CSV будет работать
5. **Интеграция с 1С** — последний этап

### Что учесть:

- **Ошибки синхронизации** — что делать, если банк недоступен?
- **Дубликаты** — как избежать повторного импорта?
- **Конфликты данных** — что делать, если данные изменились?
- **Производительность** — синхронизация может быть долгой

---

## 📚 Полезные ресурсы

### Банки:

- **Тинькофф API:** https://www.tinkoff.ru/kassa/develop/api/
- **Сбербанк API:** https://developer.sberbank.ru/
- **Альфа-Банк API:** https://developer.alfabank.ru/
- **ВТБ API:** https://api.vtb.ru/

### 1С:

- **Документация по HTTP сервисам:** https://its.1c.ru/db/v8std#content:456:hdoc
- **Примеры веб-сервисов:** https://its.1c.ru/db/v8std#content:456:hdoc

### Библиотеки:

- **csv-parser:** https://www.npmjs.com/package/csv-parser
- **xlsx:** https://www.npmjs.com/package/xlsx
- **node-cron:** https://www.npmjs.com/package/node-cron

---

**Последнее обновление:** 19 февраля 2026
