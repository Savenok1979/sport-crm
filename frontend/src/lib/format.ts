export function formatMoney(minorUnits: number, currency = "RUB"): string {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(
    minorUnits / 100
  );
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

export const employeeStatusLabels: Record<string, string> = {
  ACTIVE: "Активен",
  INVITED: "Приглашён",
  SUSPENDED: "Заблокирован",
};

export const roleLabels: Record<string, string> = {
  OWNER: "Владелец",
  ADMINISTRATOR: "Администратор",
  TRAINER: "Тренер",
};

export const athleteStatusLabels: Record<string, string> = {
  ACTIVE: "Активен",
  PAUSED: "Пауза",
  LEFT: "Выбыл",
  PENDING_SETUP: "Требует оформления",
};

export const leadStageLabels: Record<string, string> = {
  NEW: "Новая",
  TRIAL_SCHEDULED: "Записан на пробное",
  TRIAL_ATTENDED: "Пробное посещено",
  ENROLLED: "Зачислен",
  NO_SHOW: "Не пришёл",
  REJECTED: "Отказ",
  WAITLIST: "Лист ожидания",
};

export const sessionStatusLabels: Record<string, string> = {
  SCHEDULED: "Запланирована",
  HELD: "Проведена",
  CANCELLED: "Отменена",
};

export const chargeStatusLabels: Record<string, string> = {
  UNPAID: "Не оплачено",
  PARTIALLY_PAID: "Частично оплачено",
  PAID: "Оплачено",
};

export const paymentMethodLabels: Record<string, string> = {
  CASH: "Наличные",
  BANK_TRANSFER: "Банковский перевод",
  SBP: "СБП",
  CARD: "Карта",
  OTHER: "Другое",
};

export const dayOfWeekLabels = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

export const communicationStatusLabels: Record<string, string> = {
  QUEUED: "В очереди",
  SENT: "Отправлено",
  DELIVERED: "Доставлено",
  FAILED: "Ошибка",
  BOUNCED: "Отклонено",
};
