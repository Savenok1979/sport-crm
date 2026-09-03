import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Athlete } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Spinner,
  Table,
  Td,
  Th,
  Textarea,
  Tr,
} from "../../components/ui";
import { athleteStatusLabels, chargeStatusLabels, formatDate, formatDateTime, formatMoney } from "../../lib/format";
import AddToGroupModal from "./AddToGroupModal";
import AddRepresentativeModal from "./AddRepresentativeModal";
import PaymentModal from "../finance/PaymentModal";

const tabs = ["Основное", "Группы", "Посещаемость", "Финансы", "Коммуникации"] as const;
type Tab = (typeof tabs)[number];

export default function AthleteDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const canManage = session?.role === "OWNER" || session?.role === "ADMINISTRATOR";
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Основное");
  const [addToGroupOpen, setAddToGroupOpen] = useState(false);
  const [addRepOpen, setAddRepOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const athleteQuery = useQuery({
    queryKey: ["athlete", id],
    queryFn: () => api.get<Athlete>(`/athletes/${id}`),
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["athlete", id] });

  if (athleteQuery.isLoading) return <Spinner />;
  if (!athleteQuery.data) return <EmptyState>Спортсмен не найден</EmptyState>;
  const athlete = athleteQuery.data;
  const visibleTabs = tabs.filter((t) => t !== "Финансы" || canManage);

  return (
    <div>
      <Link to="/athletes" className="mb-3 inline-block text-sm text-slate-500 hover:underline">
        ← Спортсмены
      </Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{athlete.fullName}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={athlete.status === "ACTIVE" ? "green" : athlete.status === "LEFT" ? "red" : "amber"}>
              {athleteStatusLabels[athlete.status]}
            </Badge>
            <span className="text-xs text-slate-400">С {formatDate(athlete.startDate)}</span>
          </div>
        </div>
        {canManage && <LifecycleActions athleteId={athlete.id} status={athlete.status} onDone={invalidate} />}
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Основное" && <BasicInfoTab athlete={athlete} canManage={canManage} onSaved={invalidate} />}

      {tab === "Группы" && (
        <Card className="p-4">
          <div className="mb-3 flex justify-between">
            <p className="text-sm font-medium text-slate-700">Группы и тарифы</p>
            {canManage && (
              <Button variant="secondary" onClick={() => setAddToGroupOpen(true)}>
                + Добавить в группу
              </Button>
            )}
          </div>
          {!athlete.athleteGroups.length ? (
            <EmptyState>Спортсмен пока не в группах</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Группа</Th>
                  <Th>Статус</Th>
                  <Th>Начало</Th>
                  <Th>Окончание</Th>
                  {canManage && <Th>Тариф</Th>}
                </tr>
              </thead>
              <tbody>
                {athlete.athleteGroups.map((ag) => (
                  <Tr key={ag.id}>
                    <Td className="font-medium text-slate-900">{ag.group.name}</Td>
                    <Td>
                      <Badge tone={ag.status === "ACTIVE" ? "green" : "slate"}>{ag.status === "ACTIVE" ? "Активна" : "Закрыта"}</Badge>
                    </Td>
                    <Td>{formatDate(ag.startDate)}</Td>
                    <Td>{formatDate(ag.endDate)}</Td>
                    {canManage && <Td>{ag.athleteTariffs?.map((t) => t.tariff.name).join(", ") || "—"}</Td>}
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "Посещаемость" && (
        <Card className="p-4">
          {!athlete.attendances?.length ? (
            <EmptyState>Посещений пока нет</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Дата</Th>
                  <Th>Статус</Th>
                </tr>
              </thead>
              <tbody>
                {athlete.attendances.map((a) => (
                  <Tr key={a.id}>
                    <Td>{formatDateTime(a.markedAt)}</Td>
                    <Td>
                      <Badge tone={a.status === "PRESENT" ? "green" : "red"}>{a.status === "PRESENT" ? "Был" : "Не был"}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "Финансы" && canManage && (
        <Card className="p-4">
          <div className="mb-3 flex justify-between">
            <p className="text-sm font-medium text-slate-700">Начисления</p>
            <Button variant="secondary" onClick={() => setPaymentOpen(true)}>
              Принять оплату
            </Button>
          </div>
          {!athlete.charges?.length ? (
            <EmptyState>Начислений пока нет</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Период</Th>
                  <Th>Сумма</Th>
                  <Th>Срок оплаты</Th>
                  <Th>Статус</Th>
                </tr>
              </thead>
              <tbody>
                {athlete.charges.map((c) => (
                  <Tr key={c.id}>
                    <Td>{c.period}</Td>
                    <Td>{formatMoney(c.totalAmount)}</Td>
                    <Td>{formatDate(c.dueDate)}</Td>
                    <Td>
                      <Badge tone={c.status === "PAID" ? "green" : c.status === "PARTIALLY_PAID" ? "amber" : "red"}>
                        {chargeStatusLabels[c.status]}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "Коммуникации" && (
        <Card className="p-4">
          <div className="mb-3 flex justify-between">
            <p className="text-sm font-medium text-slate-700">Представители</p>
            {canManage && (
              <Button variant="secondary" onClick={() => setAddRepOpen(true)}>
                + Представитель
              </Button>
            )}
          </div>
          {!athlete.representatives?.length ? (
            <EmptyState>Представители не добавлены</EmptyState>
          ) : (
            <ul className="space-y-2 text-sm">
              {athlete.representatives.map((r) => (
                <li key={r.representative.id} className="flex flex-wrap gap-x-3 text-slate-600">
                  <span className="font-medium text-slate-900">{r.representative.fullName}</span>
                  {r.representative.phone && <span>{r.representative.phone}</span>}
                  {r.representative.email && <span>{r.representative.email}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {addToGroupOpen && <AddToGroupModal athleteId={athlete.id} onClose={() => setAddToGroupOpen(false)} onSaved={invalidate} />}
      {addRepOpen && <AddRepresentativeModal athleteId={athlete.id} onClose={() => setAddRepOpen(false)} onSaved={invalidate} />}
      {paymentOpen && (
        <PaymentModal athleteId={athlete.id} athleteName={athlete.fullName} onClose={() => setPaymentOpen(false)} onSaved={invalidate} />
      )}
    </div>
  );
}

function LifecycleActions({ athleteId, status, onDone }: { athleteId: string; status: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (body: Record<string, unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await api.post(`/athletes/${athleteId}/lifecycle`, body);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось обновить статус");
    } finally {
      setBusy(false);
    }
  };

  const onLeave = () => {
    const reason = window.prompt("Причина ухода?");
    if (!reason) return;
    run({ action: "leave", leftDate: new Date().toISOString(), leftReason: reason });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status !== "ACTIVE" && (
          <Button variant="secondary" disabled={busy} onClick={() => run({ action: "activate" })}>
            Активировать
          </Button>
        )}
        {status === "ACTIVE" && (
          <Button variant="secondary" disabled={busy} onClick={() => run({ action: "pause", pauseStartDate: new Date().toISOString() })}>
            Пауза
          </Button>
        )}
        {status !== "LEFT" && (
          <Button variant="danger" disabled={busy} onClick={onLeave}>
            Отчислить
          </Button>
        )}
      </div>
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

function BasicInfoTab({ athlete, canManage, onSaved }: { athlete: Athlete; canManage: boolean; onSaved: () => void }) {
  const [fullName, setFullName] = useState(athlete.fullName);
  const [adminComment, setAdminComment] = useState(athlete.adminComment ?? "");
  const [coachComment, setCoachComment] = useState(athlete.coachComment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/athletes/${athlete.id}`, { fullName, adminComment, coachComment });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-xl space-y-3 p-4">
      <Field label="ФИО">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={!canManage} />
      </Field>
      <Field label="Дата рождения">
        <Input value={formatDate(athlete.dateOfBirth)} disabled />
      </Field>
      <Field label="Административный комментарий">
        <Textarea rows={2} value={adminComment} onChange={(e) => setAdminComment(e.target.value)} disabled={!canManage} />
      </Field>
      <Field label="Тренерский комментарий">
        <Textarea rows={2} value={coachComment} onChange={(e) => setCoachComment(e.target.value)} />
      </Field>
      {error && <ErrorBanner message={error} />}
      <Button onClick={save} disabled={saving}>
        {saving ? "Сохраняем…" : "Сохранить"}
      </Button>
    </Card>
  );
}
