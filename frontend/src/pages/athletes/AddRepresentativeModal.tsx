import { useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { Button, ErrorBanner, Field, Input, Modal } from "../../components/ui";

export default function AddRepresentativeModal({
  athleteId,
  onClose,
  onSaved,
}: {
  athleteId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/athletes/${athleteId}/representatives`, {
        fullName,
        phone: phone || undefined,
        email: email || undefined,
        isPrimary,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить представителя");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Добавить представителя" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="ФИО">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
        </Field>
        <Field label="Телефон">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 900 000-00-00" />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Основной контакт
        </label>
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
