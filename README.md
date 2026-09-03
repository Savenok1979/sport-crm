# Sports CRM — backend scaffold

Стартовый каркас MVP по `docs/PRD.md` (полное ТЗ). Стек: Node + Express +
TypeScript + Prisma + SQLite (для локальной разработки; в `prisma/schema.prisma`
провайдер меняется на `postgresql` одной строкой, когда понадобится staging).

## Что уже реально работает

- **Полная модель данных** из раздела 14 ТЗ — `prisma/schema.prisma`
  (Organization → Venue/SportType → Group → Athlete → Charge → Payment и т.д.,
  все связи из 14.1).
- **Вертикальный срез** ключевого流а «заявка → зачисление → группа →
  расписание → посещаемость → начисление → оплата»:
  - `src/routes/auth.ts` — вход, JWT с ролью и organizationId внутри токена.
  - `src/routes/leads.ts` — воронка, дубли по ФИО+телефону, зачисление создаёт Athlete.
  - `src/routes/athletes.ts` — список со scope по роли, quick-add тренера.
  - `src/routes/groups.ts` — группы, ScheduleRule → генерация TrainingSession
    (идемпотентно: повторный запуск не плодит дубли).
  - `src/routes/attendance.ts` — «Сегодня», отметка Был/Не был, блокировка
    редактирования для тренера после конца дня, «Завершить».
  - `src/routes/finance.ts` — идемпотентные месячные начисления, приём
    оплаты с распределением по самому старому долгу, сторнирование (без
    физического удаления), долги с aging.
- **Backend-проверка роли и scope** — не только на фронте (раздел 3, 15,
  приёмочный тест №17): `requireAuth`, `requireRole`, ручной scope-фильтр
  тренера в athletes/attendance.

## Что ещё не сделано (осознанно, для следующего шага)

- Venues/Employees/Settings/Mailings/Analytics/Receipts как отдельные роуты.
- Self-onboarding организации.
- Очереди для email/PDF/массовых операций (раздел 15 «Фоновые задачи»).
- 2FA, rate limiting, session revocation.
- Тесты (unit на idempotency начислений/платежей, integration на scope).
- Реальная генерация PDF-квитанций и e-mail-провайдер.

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
```

## Как продолжать в Claude Code

Открой эту папку как проект в Claude Code и продолжай с одного из пунктов
выше из «Что ещё не сделано» — например:

> Реализуй роуты venues и employees по образцу groups.ts и athletes.ts,
> с scope-проверкой из auth.ts. Прочитай docs/PRD.md раздел 3 и 15 перед началом.

или

> Добавь очередь (bullmq + redis, либо просто in-process job runner для
> старта) для отправки email по CommunicationLog, по правилам раздела 9 и 13.

`docs/PRD.md` — это полное ТЗ, отдающее контекст по бизнес-правилам; ссылайся
на него в запросах к Claude Code вместо пересказа требований заново.
