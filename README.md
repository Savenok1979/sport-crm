# Sports CRM

Полноценное MVP-приложение по `PRD.md` (техническое задание): backend API +
веб-фронтенд (десктопная панель владельца/администратора и mobile-first PWA
тренера). Стек: Node + Express + TypeScript + Prisma + SQLite на бэкенде,
React + Vite + TypeScript + Tailwind на фронтенде.

## Структура репозитория

```
src/          backend: Express-роуты, middleware, бизнес-логика
prisma/       schema.prisma, миграции, seed
frontend/     React/Vite SPA (десктоп для owner/admin, mobile PWA для тренера)
PRD.md        полное ТЗ — ссылайся на него в запросах к Claude Code
```

## Что реализовано

### Backend (`src/`)

- **Полная модель данных** из раздела 14 ТЗ — `prisma/schema.prisma`
  (Organization → Venue/SportType → Group → Athlete → Charge → Payment и т.д.,
  все связи из 14.1). SQLite не поддерживает enum в Prisma — статусные поля
  хранятся как `String`, допустимые значения задокументированы в
  `src/lib/domain-types.ts`.
- **Все домены API из раздела 15**: `auth`, `athletes`, `leads`, `venues`,
  `groups`, `sessions`, `attendance`, `finance`, `mailings`, `analytics`,
  `employees`, `settings` — каждый под `src/routes/*.ts`. В частности:
  - Спортсмены: карточка, quick-add тренера, редактирование, lifecycle
    (активировать/пауза/отчислить), зачисление в группу с тарифом,
    представители.
  - Группы: CRUD, назначение тренеров, привязка тарифов, ScheduleRule →
    идемпотентная генерация TrainingSession.
  - Расписание: просмотр с фильтрами, отмена (только с причиной,
    форс-мажор), индивидуальные тренировки с разовым начислением и
    проверкой конфликта тренера.
  - Посещаемость: «Сегодня» с полным ростером группы (включая ещё не
    отмеченных), Был/Не был, блокировка редактирования для тренера после
    конца дня, «Завершить».
  - Финансы: тарифы, идемпотентные месячные начисления, приём оплаты с
    распределением по самому старому долгу, сторнирование (без физического
    удаления), долги с aging.
  - Рассылки: шаблоны с предпросмотром переменных, массовая отправка по
    scope (организация/площадка/спорт/группа/выбранные), дедуп по e-mail.
  - Аналитика: спортсмены, посещаемость, финансы, воронка, KPI тренеров.
  - Сотрудники и настройки (виды спорта, тарифы, реквизиты организации).
- **Backend-проверка роли и scope** — не только на фронте (раздел 3,
  приёмочные тесты №16–17): `requireAuth`/`requireRole`
  (`src/middleware/auth.ts`) и `resolveVenueScope`/`resolveGroupScope`/
  `assertAthleteInScope` (`src/lib/scope.ts`) применены во всех роутах —
  администратор не видит данные чужой площадки, тренер никогда не получает
  финансовые суммы даже прямым запросом к API.

### Frontend (`frontend/`)

- Единая React-SPA с двумя раскладками, переключаемыми по роли из JWT:
  - **Desktop** (Owner/Administrator) — левое меню, весь функционал из карты
    экранов раздела 11: дашборд, спортсмены, заявки, площадки, группы,
    расписание, посещаемость, финансы, рассылки, аналитика, сотрудники,
    настройки.
  - **Mobile PWA** (Trainer) — нижняя навигация «Сегодня · Группы ·
    Расписание · Ещё» (раздел 11.1), с тем же потоком «Сегодня → тренировка
    → отметить всех Был → изменить отсутствующих → Завершить».
- React Query для данных, React Router для навигации, Tailwind для стилей.
- `vite-plugin-pwa` — манифест и service worker для установки на домашний
  экран (раздел 15 «PWA»).

## Осознанно не реализовано (следующий шаг, вне текущего объёма)

- Self-onboarding новой организации (сейчас организация создаётся через seed).
- Очереди для email/PDF/массовых операций (раздел 15 «Фоновые задачи») —
  рассылки и генерация начислений сейчас выполняются синхронно.
- Реальный e-mail провайдер и генерация PDF-квитанций — `mailings.ts`
  логирует отправку как выполненную сразу, `Receipt` в схеме есть, но роут
  генерации PDF не реализован.
- 2FA, rate limiting, session revocation, forced logout.
- Excel import/export.
- Тесты (unit на idempotency начислений/платежей, integration на scope).
- В карточке спортсмена нет UI для «Перевести между группами» (backend это
  умеет через `transferFromAthleteGroupId`, фронтенд пока не даёт этот флаг).

## Запуск локально

Backend:

```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run seed        # создаст организацию, owner/coach логины, одну группу и спортсмена
npm run dev          # http://localhost:4000/health
```

Frontend (в отдельном терминале):

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, проксирует /api на :4000
```

Тестовые логины после `npm run seed`:
- `owner@example.com` / `password123` (роль OWNER)
- `coach@example.com` / `password123` (роль TRAINER)

Быстрая проверка backend руками:

```bash
# 1. логин
curl -s localhost:4000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"owner@example.com","password":"password123"}'

# 2. сгенерировать тренировки на 8 недель вперёд по ScheduleRule из seed
curl -s -X POST "localhost:4000/api/v1/groups/schedule-rules/<ruleId>/generate?weeks=8" \
  -H "authorization: Bearer <token>"

# 3. начислить за текущий месяц (идемпотентно)
curl -s -X POST localhost:4000/api/v1/finance/charges/generate-monthly \
  -H "authorization: Bearer <token>" -H 'content-type: application/json' -d '{}'
```

## Как продолжать в Claude Code

Открой эту папку как проект в Claude Code и продолжай с одного из пунктов
из «Осознанно не реализовано» — например:

> Добавь очередь (bullmq + redis, либо просто in-process job runner для
> старта) для отправки email по CommunicationLog, по правилам раздела 9 и 13.

или

> Добавь в карточку спортсмена (frontend/src/pages/athletes/AthleteDetail.tsx)
> кнопку «Перевести в другую группу», которая вызывает
> POST /athletes/:id/groups с transferFromAthleteGroupId, по сценарию
> «Перевод группы» из раздела 12.

`PRD.md` — это полное ТЗ, отдающее контекст по бизнес-правилам; ссылайся
на него в запросах к Claude Code вместо пересказа требований заново.
