import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import type { Athlete } from "../../api/types";
import { Button, ErrorBanner, Field, Input, Modal, Select } from "../../components/ui";

export default function CreateIndividualModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const athletes = useQuery({ queryKey: ["athletes"], queryFn: () => api.get<Athlete[]>("/athletes") });
  const [athleteId, setAthleteId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const minorUnits = Math.round(Number(price) * 100);
    if (!minorUnits || minorUnits <= 0) {
      setError("Введите цену больше нуля");
      return;
    }
    setSaving(true);
    try {
      await api.post("/sessions/individual", {
        athleteId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        price: minorUnits,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать индивидуальную тренировку");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Индивидуальная тренировка" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Спортсмен">
          <Select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} required>
            <option value="" disabled>
              Выберите спортсмена
            </option>
            {athletes.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Дата и время">
          <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
        </Field>
        <Field label="Цена, ₽">
          <Input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving || !athleteId}>
            {saving ? "Сохраняем…" : "Создать"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
