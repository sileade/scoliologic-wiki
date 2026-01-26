# Отчёт по оптимизации производительности

**Дата:** 26 января 2026

## 1. Анализ текущей производительности

### Размеры бандлов

| Файл | Размер (raw) | Размер (gzip) |
|---|---|---|
| `index-DcfSk3sN.js` | **2.4 MB** | **606 KB** |
| `index-DzT-k5vc.css` | 141 KB | 22 KB |
| **Итого (gzip)** | - | **628 KB** |

### Время загрузки (локально)

- **Общее время:** ~2.5ms
- **Размер загрузки:** 367 KB

**Вывод:**
- **Основная проблема:** Размер JavaScript бандла (2.4 MB) является критическим. Даже с gzip-сжатием (606 KB) это слишком много для быстрой первой загрузки (FCP/LCP).
- **CSS:** Размер CSS бандла в норме.
- **Время загрузки:** Локальные замеры нерепрезентативны, но подтверждают быструю отдачу с сервера.

## 2. Причины большого размера бандла

### Отсутствие Code Splitting (Lazy Loading)

В `client/src/App.tsx` все страницы и компоненты импортируются статически:

```typescript
import Home from "./pages/Home";
import Wiki from "./pages/Wiki";
import Search from "./pages/Search";
import Admin from "./pages/Admin";
// ...

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/wiki" component={Wiki} />
      // ...
    </Switch>
  );
}
```

Это означает, что код **всех страниц** (`Home`, `Wiki`, `Search`, `Admin` и т.д.) попадает в один бандл и загружается сразу, даже если пользователь открывает только главную страницу.

### Тяжёлые зависимости

Анализ показал, что следующие библиотеки вносят наибольший вклад в размер бандла:

| Библиотека | Используется в | Примечание |
|---|---|---|
| **`@tiptap`** | `WikiEditor.tsx` | Мощный, но объёмный редактор текста. |
| **`chart.js`** | `MetricsDashboard.tsx`, `Traefik...` | Библиотека для графиков, нужна только в админ-панели. |
| **`streamdown` / `mermaid`** | `AIChatBox.tsx` | Используется для рендеринга markdown с диаграммами. |
| **`highlight.js`** | `WikiEditor.tsx` | Подсветка синтаксиса в блоках кода. |

Эти библиотеки загружаются всегда, даже если пользователь не посещает страницы, где они используются.

## 3. Рекомендации по оптимизации

### 1. Внедрить Code Splitting (Lazy Loading)

Это **самая важная** оптимизация. Необходимо разделить код по маршрутам (страницам).

**Пример для `App.tsx`:**

```typescript
import React, { Suspense, lazy } from 'react';
import { Route, Switch } from "wouter";
// ...

// Ленивая загрузка страниц
const Home = lazy(() => import('./pages/Home'));
const Wiki = lazy(() => import('./pages/Wiki'));
const Search = lazy(() => import('./pages/Search'));
const Admin = lazy(() => import('./pages/Admin'));
const NotFound = lazy(() => import('./pages/NotFound'));

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/wiki" component={Wiki} />
        <Route path="/wiki/:slug" component={Wiki} />
        <Route path="/search" component={Search} />
        <Route path="/admin" component={Admin} />
        <Route path="/admin/:section" component={Admin} />
        // ...
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
```

**Ожидаемый результат:**
- Размер начального JS бандла сократится до **~100-150 KB** (gzip).
- Код каждой страницы будет загружаться только при её посещении.
- Значительное улучшение FCP и LCP.

### 2. Ленивая загрузка тяжёлых компонентов

Даже внутри страниц можно подгружать тяжёлые компоненты динамически.

**Пример для `Admin.tsx`:**

```typescript
const MetricsDashboard = lazy(() => import('@/components/MetricsDashboard'));

// ...

{activeTab === 'metrics' && (
  <Suspense fallback={<Loader />}>
    <MetricsDashboard />
  </Suspense>
)}
```

Это позволит не загружать `chart.js` до тех пор, пока пользователь не откроет соответствующую вкладку в админ-панели.

### 3. Анализ и оптимизация зависимостей

- **`highlight.js`**: Можно заменить на более легковесную альтернативу или использовать динамический импорт только для нужных языков.
- **`moment.js`**: Если используется, заменить на `date-fns` или `day.js` (уже используется `date-fns`).
- **Иконки (`lucide-react`)**: Убедиться, что настроен tree-shaking и импортируются только используемые иконки (уже сделано).

### 4. Настройка Vite для production

В `vite.config.ts` можно добавить `rollup-plugin-visualizer` для визуального анализа бандла:

```typescript
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    // ...
    visualizer({ open: true, gzipSize: true }),
  ],
  // ...
});
```

Это поможет точно определить, какие модули занимают больше всего места.

## 4. Итоговый план действий

1. **Реализовать Code Splitting** для всех страниц в `App.tsx` с использованием `React.lazy` и `Suspense`.
2. **Применить ленивую загрузку** для тяжёлых компонентов (`WikiEditor`, `MetricsDashboard`, `AIChatBox`) внутри страниц.
3. **Проанализировать бандл** с помощью `rollup-plugin-visualizer` после внедрения lazy loading.
4. **Провести повторные замеры** производительности и убедиться в значительном сокращении размера начального бандла.

**Прогнозируемое улучшение:** Сокращение размера начального JS бандла на **80-90%**, что кардинально улучшит время первой загрузки для пользователей.
