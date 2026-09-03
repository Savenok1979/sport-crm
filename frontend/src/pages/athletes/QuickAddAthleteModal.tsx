import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import type { Group } from "../../api/types";
import { Button, ErrorBanner, Field, Input, Modal, Select } from "../../components/ui";

export default function QuickAddAthleteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api.get<Group[]>("/groups") });
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/athletes/quick-add", {
        fullName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
        parentName: parentName || undefined,
        phone: phone || undefined,
        groupId: groupId || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить спортсмена");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Быстрое добавление спортсмена" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="ФИО ребёнка">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
        </Field>
        <Field label="Дата рождения">
          <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </Field>
        <Field label="Имя родителя">
          <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
        </Field>
        <Field label="Телефон родителя">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 900 000-00-00" />
        </Field>
        <Field label="Группа">
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Без группы</option>
            {groups.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-slate-400">
          Карточка получит статус «Требует оформления» до завершения администратором.
        </p>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Сохраняем…" : "Добавить"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
