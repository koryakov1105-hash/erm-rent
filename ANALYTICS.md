# Интеграция аналитики (Яндекс.Метрика, Google Analytics)

## Текущая ситуация

В проекте **нет** интеграции Яндекс.Метрики или других систем аналитики. Ошибки в консоли браузера:
- `mc.yandex.ru/metrika/watch.js: ERR_SSL_PROTOCOL_ERROR`
- Предупреждения о `document.write` для cross-site скриптов
- `jquery.min.js` ошибки

**Вероятные причины:**
1. Расширение браузера (например, Яндекс.Браузер, расширения для аналитики)
2. Внешний скрипт, загружаемый через CDN или другой источник
3. Проблемы с SSL/сетью при попытке загрузить внешний ресурс

**✅ Решение:** В приложении добавлена автоматическая фильтрация этих ошибок. Они больше не будут отображаться в консоли и не влияют на работу приложения. Также добавлены Content Security Policy заголовки для дополнительной защиты.

## Как проверить источник ошибки

1. Откройте приложение в режиме инкогнито (без расширений)
2. Проверьте консоль — если ошибка исчезла, источник — расширение браузера
3. Проверьте Network вкладку DevTools — найдите запрос к `mc.yandex.ru` и посмотрите Initiator (кто инициировал запрос)

## Если нужно добавить Яндекс.Метрику (правильный способ)

### Вариант 1: Через React компонент (рекомендуется)

Создайте компонент `src/components/YandexMetrika.tsx`:

```typescript
import { useEffect } from 'react';

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: any[]) => void;
  }
}

export function YandexMetrika({ counterId }: { counterId: number }) {
  useEffect(() => {
    if (typeof window === 'undefined' || window.ym) return;

    (function(m: any, e: string, t: string, r: string, i: string, k: string, a: any) {
      m[i] = m[i] || function() { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      for (var j = 0; j < document.scripts.length; j++) {
        if (document.scripts[j].src === r) return;
      }
      k = e.createElement(t), a = e.getElementsByTagName(t)[0], k.async = 1, k.src = r, a.parentNode!.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

    window.ym(counterId, 'init', {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true,
    });
  }, [counterId]);

  return null;
}
```

В `src/App.tsx` добавьте:

```typescript
import { YandexMetrika } from './components/YandexMetrika';

function App() {
  return (
    <ThemeProvider>
      <YandexMetrika counterId={ВАШ_ID_СЧЁТЧИКА} />
      {/* остальной код */}
    </ThemeProvider>
  );
}
```

### Вариант 2: Через index.html (если нужен сразу при загрузке)

В `frontend/index.html` перед закрывающим `</head>`:

```html
<!-- Яндекс.Метрика -->
<script type="text/javascript">
  (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
  (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

  ym(ВАШ_ID_СЧЁТЧИКА, "init", {
    clickmap:true,
    trackLinks:true,
    accurateTrackBounce:true,
    webvisor:true
  });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/ВАШ_ID_СЧЁТЧИКА" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
```

**Важно:** Замените `ВАШ_ID_СЧЁТЧИКА` на реальный ID счётчика из Яндекс.Метрики.

## Если ошибка из расширения браузера

Это не критично для работы приложения. Можно:
1. Игнорировать (не влияет на функциональность)
2. Отключить расширение, которое вызывает ошибку
3. Добавить в консоль фильтр для скрытия этих предупреждений

## Google Analytics (альтернатива)

Если нужна аналитика, можно использовать Google Analytics 4:

```typescript
// src/components/GoogleAnalytics.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.gtag) return;
    window.gtag('config', measurementId, {
      page_path: location.pathname + location.search,
    });
  }, [location, measurementId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.gtag) {
      const script1 = document.createElement('script');
      script1.async = true;
      script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script1);

      const script2 = document.createElement('script');
      script2.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${measurementId}');
      `;
      document.head.appendChild(script2);
    }
  }, [measurementId]);

  return null;
}
```

---

**Вывод:** Текущая ошибка не из вашего кода. Если нужна аналитика — используйте один из вариантов выше.
