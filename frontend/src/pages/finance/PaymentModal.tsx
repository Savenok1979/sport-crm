import { useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import type { PaymentMethod } from "../../api/types";
import { Button, ErrorBanner, Field, Input, Modal, Select } from "../../components/ui";
import { paymentMethodLabels } from "../../lib/format";

// Section 8.4: default allocation is oldest-unpaid-first, done server-side —
// this form only captures amount + method, matching the "Финансы → Принять
// оплату → спортсмен → сумма/метод → распределение" flow from section 12.
export default function PaymentModal({
  athleteId,
  athleteName,
  onClose,
  onSaved,
}: {
  athleteId: string;
  athleteName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const minorUnits = Math.round(Number(amount) * 100);
    if (!minorUnits || minorUnits <= 0) {
      setError("Введите сумму больше нуля");
      return;
    }
    setSaving(true);
    try {
      await api.post("/finance/payments", { athleteId, amount: minorUnits, method });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось провести платёж");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Принять оплату — ${athleteName}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Сумма, ₽">
          <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </Field>
        <Field label="Способ оплаты">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {Object.entries(paymentMethodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-slate-400">Платёж распределится на самое старое непогашенное начисление.</p>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Проводим…" : "Принять оплату"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
