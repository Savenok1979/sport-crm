import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import type { Group, Tariff } from "../../api/types";
import { Button, ErrorBanner, Field, Input, Modal, Select } from "../../components/ui";
import { formatMoney } from "../../lib/format";

export default function AddToGroupModal({
  athleteId,
  onClose,
  onSaved,
}: {
  athleteId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api.get<Group[]>("/groups") });
  const tariffs = useQuery({ queryKey: ["tariffs"], queryFn: () => api.get<Tariff[]>("/settings/tariffs") });
  const [groupId, setGroupId] = useState("");
  const [tariffId, setTariffId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/athletes/${athleteId}/groups`, {
        groupId,
        tariffId,
        startDate: new Date(startDate).toISOString(),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось зачислить в группу");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Добавить в группу" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Группа">
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
            <option value="" disabled>
              Выберите группу
            </option>
            {groups.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Тариф">
          <Select value={tariffId} onChange={(e) => setTariffId(e.target.value)} required>
            <option value="" disabled>
              Выберите тариф
            </option>
            {tariffs.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {formatMoney(t.price)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Дата начала">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </Field>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving || !groupId || !tariffId}>
            {saving ? "Сохраняем…" : "Добавить"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
