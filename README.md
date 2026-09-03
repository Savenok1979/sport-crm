# Sports CRM — backend

Полный backend MVP по `PRD.md` (техническое задание). Стек: Node + Express +
TypeScript + Prisma + SQLite (для локальной разработки; в `prisma/schema.prisma`
провайдер меняется на `postgresql` одной строкой, когда понадобится staging).

## Что реализовано

- **Полная модель данных** из раздела 14 ТЗ — `prisma/schema.prisma`
  (Organization → Venue/SportType → Group → Athlete → Charge → Payment и т.д.,
  все связи из 14.1).
- **Все домены API из раздела 15**: `auth`, `athletes`, `leads`, `venues`,
  `groups`, `sessions`, `attendance`, `finance`, `mailings`, `analytics`,
  `employees`, `settings` — каждый под `src/routes/*.ts`.
  - `auth.ts` — вход, JWT с ролью и organizationId внутри токена.
  - `leads.ts` — воронка, дубли по ФИО+телефону, зачисление создаёт Athlete.
  - `athletes.ts` — список/карточка со scope по роли, quick-add тренера.
  - `venues.ts` — площадки и залы/зоны, scope по роли.
  - `groups.ts` — группы, ScheduleRule → генерация TrainingSession
    (идемпотентно: повторный запуск не плодит дубли).
  - `sessions.ts` — расписание неделя/месяц с фильтрами, отмена тренировки
    (только с причиной), индивидуальные тренировки с разовым начислением и
    проверкой конфликта тренера.
  - `attendance.ts` — «Сегодня», отметка Был/Не был, блокировка
    редактирования для тренера после конца дня, «Завершить».
  - `finance.ts` — идемпотентные месячные начисления, приём оплаты с
    распределением по самому старому долгу, сторнирование (без физического
    удаления), долги с aging.
  - `mailings.ts` — шаблоны сообщений, предпросмотр с подстановкой
    переменных, массовая рассылка по scope (организация/площадка/спорт/
    группа/выбранные), дедуп по e-mail, история по получателю.
  - `analytics.ts` — спортсмены, посещаемость (лучшие/худшие группы,
    незаполненные занятия), финансы (начислено/оплачено/долг/собираемость +
    aging), воронка, KPI тренеров.
  - `employees.ts` — список/приглашение сотрудников, роль/статус, назначение
    доступа к площадкам администратору (только владелец).
  - `settings.ts` — реквизиты организации, виды спорта (добавить/
    переименовать/архивировать).
- **Backend-проверка роли и scope** — не только на фронте (раздел 3, 15,
  приёмочный тест №17): `requireAuth`, `requireRole` (`src/middleware/auth.ts`)
  и `resolveVenueScope`/`resolveGroupScope`/`assertAthleteInScope`
  (`src/lib/scope.ts`), применённые во всех роутах, а не только для тренера —
  администратор тоже не видит данные чужой площадки (приёмочный тест №16).

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
- Фронтенд — отдельная задача.

## Запуск локально

```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run seed        # создаст организацию, owner/coach логины, одну группу и спортсмена
npm run dev          # http://localhost:4000/health
```

Тестовые логины после `npm run seed`:
- `owner@example.com` / `password123` (роль OWNER)
- `coach@example.com` / `password123` (роль TRAINER)

Быстрая проверка руками:

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

# 4. дашборд/аналитика
curl -s "localhost:4000/api/v1/analytics/finance" -H "authorization: Bearer <token>"
```

## Как продолжать в Claude Code

Открой эту папку как проект в Claude Code и продолжай с одного из пунктов
из «Осознанно не реализовано» — например:

> Добавь очередь (bullmq + redis, либо просто in-process job runner для
> старта) для отправки email по CommunicationLog, по правилам раздела 9 и 13.

или

> Собери React/Vite фронтенд: панель владельца/администратора (desktop) и
> mobile-first PWA тренера («Сегодня → тренировка → посещаемость»), по
> карте экранов из раздела 11.

`PRD.md` — это полное ТЗ, отдающее контекст по бизнес-правилам; ссылайся
на него в запросах к Claude Code вместо пересказа требований заново.
