import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Employee, Group, ScheduleRule, Tariff } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Table,
  Td,
  Th,
  Tr,
} from "../../components/ui";
import { dayOfWeekLabels, formatDate, formatMoney } from "../../lib/format";

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const canManage = session?.role === "OWNER" || session?.role === "ADMINISTRATOR";
  const queryClient = useQueryClient();
  const [ruleOpen, setRuleOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [tariffOpen, setTariffOpen] = useState(false);

  const group = useQuery({
    queryKey: ["group", id],
    queryFn: () => api.get<Group & { scheduleRules: ScheduleRule[]; groupTariffs: { tariff: Tariff }[] }>(`/groups/${id}`),
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["group", id] });

  const generateMutation = useMutation({
    mutationFn: (ruleId: string) => api.post(`/groups/schedule-rules/${ruleId}/generate?weeks=8`),
    onSuccess: (res: any) => window.alert(`Создано тренировок: ${res.createdCount}`),
  });

  if (group.isLoading) return <Spinner />;
  if (!group.data) return <EmptyState>Группа не найдена</EmptyState>;
  const g = group.data;

  return (
    <div>
      <Link to="/groups" className="mb-3 inline-block text-sm text-slate-500 hover:underline">
        ← Группы
      </Link>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{g.name}</h1>
          <p className="text-sm text-slate-500">
            {g.venue?.name} · {g.sportType?.name}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex justify-between">
            <p className="text-sm font-medium text-slate-700">Тренеры</p>
            {canManage && (
              <Button variant="ghost" onClick={() => setCoachOpen(true)}>
                + Тренер
              </Button>
            )}
          </div>
          {!g.coaches?.length ? (
            <EmptyState>Тренер не назначен</EmptyState>
          ) : (
            <ul className="space-y-1 text-sm text-slate-600">
              {g.coaches.map((c) => (
                <li key={c.id}>{c.employee.user.fullName}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex justify-between">
            <p className="text-sm font-medium text-slate-700">Тарифы группы</p>
            {canManage && (
              <Button variant="ghost" onClick={() => setTariffOpen(true)}>
                + Тариф
              </Button>
            )}
          </div>
          {!g.groupTariffs?.length ? (
            <EmptyState>Тарифы не назначены</EmptyState>
          ) : (
            <ul className="space-y-1 text-sm text-slate-600">
              {g.groupTariffs.map((gt) => (
                <li key={gt.tariff.id} className="flex justify-between">
                  <span>{gt.tariff.name}</span>
                  <span className="font-medium">{formatMoney(gt.tariff.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <div className="mb-2 flex justify-between">
          <p className="text-sm font-medium text-slate-700">Постоянное расписание</p>
          {canManage && (
            <Button variant="ghost" onClick={() => setRuleOpen(true)}>
              + Правило
            </Button>
          )}
        </div>
        {!g.scheduleRules?.length ? (
          <EmptyState>Правила расписания не заданы</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>День</Th>
                <Th>Время</Th>
                <Th>Действует с</Th>
                <Th>Действует по</Th>
                {canManage && <Th />}
              </tr>
            </thead>
            <tbody>
              {g.scheduleRules.map((r) => (
                <Tr key={r.id}>
                  <Td>{dayOfWeekLabels[r.dayOfWeek]}</Td>
                  <Td>
                    {r.startTime}–{r.endTime}
                  </Td>
                  <Td>{formatDate(r.effectiveFrom)}</Td>
                  <Td>{formatDate(r.effectiveTo)}</Td>
                  {canManage && (
                    <Td>
                      <Button variant="secondary" onClick={() => generateMutation.mutate(r.id)} disabled={generateMutation.isPending}>
                        Сгенерировать 8 недель
                      </Button>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {ruleOpen && (
        <ScheduleRuleModal group={g} onClose={() => setRuleOpen(false)} onSaved={invalidate} />
      )}
      {coachOpen && <AddCoachModal group={g} onClose={() => setCoachOpen(false)} onSaved={invalidate} />}
      {tariffOpen && <AttachTariffModal group={g} onClose={() => setTariffOpen(false)} onSaved={invalidate} />}
    </div>
  );
}

function ScheduleRuleModal({ group, onClose, onSaved }: { group: Group; onClose: () => void; onSaved: () => void }) {
  const [dayOfWeek, setDayOfWeek] = useState("0");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:00");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/groups/schedule-rules", {
        groupId: group.id,
        venueId: group.venueId,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать правило");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Новое правило расписания" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="День недели">
          <Select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
            {dayOfWeekLabels.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </Field>
          <Field label="Окончание">
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </Field>
        </div>
        <Field label="Действует с">
          <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
        </Field>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Сохраняем…" : "Создать"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AddCoachModal({ group, onClose, onSaved }: { group: Group; onClose: () => void; onSaved: () => void }) {
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => api.get<Employee[]>("/employees") });
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trainers = employees.data?.filter((e) => e.role === "TRAINER") ?? [];

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/groups/${group.id}/coaches`, { employeeId });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось назначить тренера");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Назначить тренера" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Тренер">
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
            <option value="" disabled>
              Выберите тренера
            </option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.user.fullName}
              </option>
            ))}
          </Select>
        </Field>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving || !employeeId}>
            {saving ? "Сохраняем…" : "Назначить"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AttachTariffModal({ group, onClose, onSaved }: { group: Group; onClose: () => void; onSaved: () => void }) {
  const tariffs = useQuery({ queryKey: ["tariffs"], queryFn: () => api.get<Tariff[]>("/settings/tariffs") });
  const [tariffId, setTariffId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/groups/${group.id}/tariffs`, { tariffId });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось привязать тариф");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Привязать тариф к группе" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
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
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving || !tariffId}>
            {saving ? "Сохраняем…" : "Привязать"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
