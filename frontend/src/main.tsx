import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Сохраняем оригинальные функции консоли до их переопределения
const originalError = console.error;
const originalWarn = console.warn;

// Список URL и ключевых слов для фильтрации внешних ошибок
const EXTERNAL_ERROR_PATTERNS = [
  'mc.yandex.ru',
  'metrika',
  'yandex',
  'jquery.min.js',
  'document.write',
  'parser-blocking',
  'browser.yandex.ru',
  'urlerror',
  'antisusanin',
  'cross site',
  'cross-site',
  'eTLD+1',
];

// Функция проверки, является ли ошибка внешней
function isExternalError(message: string, source?: string): boolean {
  const text = (message + ' ' + (source || '')).toLowerCase();
  return EXTERNAL_ERROR_PATTERNS.some(pattern => text.includes(pattern.toLowerCase()));
}

// Обработка глобальных ошибок React
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Фильтруем ошибки от внешних скриптов даже в ErrorBoundary
    const errorMessage = error?.message || '';
    const errorStack = error?.stack || '';
    const errorInfoStr = JSON.stringify(errorInfo) || '';
    const combined = (errorMessage + ' ' + errorStack + ' ' + errorInfoStr).toLowerCase();
    
    if (!isExternalError(combined)) {
      originalError('Application error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
          <h1>Произошла ошибка</h1>
          <p style={{ color: '#666', marginBottom: '1rem' }}>{this.state.error?.message || 'Неизвестная ошибка'}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
            style={{ padding: '0.5rem 1rem', fontSize: '1rem', cursor: 'pointer' }}
          >
            Перезагрузить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Подавление ошибок от внешних скриптов (браузерные расширения, Яндекс.Метрика и т.д.)
console.error = (...args: any[]) => {
  const message = args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.message + ' ' + arg.stack;
    return String(arg);
  }).join(' ');
  
  if (isExternalError(message)) {
    return; // Молча игнорируем эти ошибки
  }
  originalError.apply(console, args);
};

// Подавление предупреждений о внешних скриптах
console.warn = (...args: any[]) => {
  const message = args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.message;
    return String(arg);
  }).join(' ');
  
  if (isExternalError(message)) {
    return;
  }
  originalWarn.apply(console, args);
};

// Глобальная обработка ошибок загрузки скриптов и ресурсов
window.addEventListener('error', (event) => {
  let src = '';
  if (event.target) {
    const target = event.target as HTMLScriptElement | HTMLLinkElement | HTMLImageElement;
    if ('src' in target) {
      src = target.src || '';
    } else if ('href' in target) {
      src = (target as HTMLLinkElement).href || '';
    }
  }
  const message = event.message || '';
  const filename = event.filename || '';
  
  if (
    isExternalError(message + ' ' + src + ' ' + filename) ||
    src.includes('mc.yandex.ru') ||
    src.includes('metrika') ||
    src.includes('browser.yandex.ru') ||
    src.includes('urlerror') ||
    filename.includes('yandex') ||
    filename.includes('metrika')
  ) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}, true);

// Обработка необработанных отклонений промисов (для fetch ошибок)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason?.message || String(reason) || '';
  const stack = reason?.stack || '';
  
  if (isExternalError(message + ' ' + stack)) {
    event.preventDefault();
    return false;
  }
});

// Перехват ошибок из сетевых запросов (fetch, XMLHttpRequest)
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  try {
    return await originalFetch.apply(this, args);
  } catch (error: any) {
    const url = args[0]?.toString() || '';
    const message = error?.message || String(error);
    
    if (isExternalError(message + ' ' + url)) {
      // Создаем "тихую" ошибку, которая не будет логироваться
      throw new Error('Network request failed (external script)');
    }
    throw error;
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
