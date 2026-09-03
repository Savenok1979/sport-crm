import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import type { DebtRow, IndividualTraining } from "../../api/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Spinner,
  Table,
  Td,
  Th,
  Tr,
} from "../../components/ui";
import { formatDate, formatMoney, sessionStatusLabels } from "../../lib/format";
import PaymentModal from "./PaymentModal";
import CreateIndividualModal from "./CreateIndividualModal";

const tabs = ["Долги", "Индивидуальные", "Начисления"] as const;
type Tab = (typeof tabs)[number];

const bucketTone: Record<DebtRow["bucket"], "amber" | "red"> = { "1-7": "amber", "8-30": "amber", "30+": "red" };

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("Долги");

  return (
    <div>
      <PageHeader title="Финансы" />
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
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

      {tab === "Долги" && <DebtsTab />}
      {tab === "Индивидуальные" && <IndividualTab />}
      {tab === "Начисления" && <ChargesTab />}
    </div>
  );
}

function DebtsTab() {
  const [payFor, setPayFor] = useState<{ athleteId: string; name: string } | null>(null);
  const query = useQuery({ queryKey: ["finance", "debts"], queryFn: () => api.get<DebtRow[]>("/finance/debts") });

  return (
    <Card>
      {query.isLoading ? (
        <Spinner />
      ) : !query.data?.length ? (
        <EmptyState>Задолженностей нет</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Спортсмен</Th>
              <Th>Остаток</Th>
              <Th>Просрочка</Th>
              <Th>Aging</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {query.data.map((row) => (
              <Tr key={row.chargeId}>
                <Td className="font-medium text-slate-900">{row.athlete}</Td>
                <Td>{formatMoney(row.remaining)}</Td>
                <Td>{row.days} дн.</Td>
                <Td>
                  <Badge tone={bucketTone[row.bucket]}>{row.bucket}</Badge>
                </Td>
                <Td>
                  <Button variant="secondary" onClick={() => setPayFor({ athleteId: row.athleteId, name: row.athlete })}>
                    Принять оплату
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      {payFor && (
        <PaymentModal
          athleteId={payFor.athleteId}
          athleteName={payFor.name}
          onClose={() => setPayFor(null)}
          onSaved={() => query.refetch()}
        />
      )}
    </Card>
  );
}

function ChargesTab() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => api.post<{ created: number; consideredAthleteTariffs: number }>("/finance/charges/generate-monthly", { period }),
    onSuccess: (res) => setResult(`Создано начислений: ${res.created} из ${res.consideredAthleteTariffs} активных тарифов`),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось сформировать начисления"),
  });

  return (
    <Card className="max-w-md p-4">
      <p className="mb-3 text-sm text-slate-600">
        Сформировать ежемесячные начисления для всех активных тарифов. Операция идемпотентна — повторный запуск за уже
        начисленный период ничего не изменит.
      </p>
      <div className="flex items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Период</span>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <Button onClick={() => { setError(null); setResult(null); mutation.mutate(); }} disabled={mutation.isPending}>
          Сформировать
        </Button>
      </div>
      {result && <p className="mt-3 text-sm text-emerald-700">{result}</p>}
      {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
    </Card>
  );
}

function IndividualTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const query = useQuery({ queryKey: ["individual-trainings"], queryFn: () => api.get<IndividualTraining[]>("/sessions/individual") });
  const holdMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sessions/individual/${id}/hold`),
    onSuccess: () => query.refetch(),
  });

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>+ Индивидуальная тренировка</Button>
      </div>
      <Card>
        {query.isLoading ? (
          <Spinner />
        ) : !query.data?.length ? (
          <EmptyState>Индивидуальных тренировок нет</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Спортсмен</Th>
                <Th>Дата</Th>
                <Th>Цена</Th>
                <Th>Статус</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {query.data.map((it) => (
                <Tr key={it.id}>
                  <Td className="font-medium text-slate-900">{it.athlete?.fullName}</Td>
                  <Td>{formatDate(it.scheduledAt)}</Td>
                  <Td>{formatMoney(it.price)}</Td>
                  <Td>
                    <Badge tone={it.status === "HELD" ? "green" : it.status === "CANCELLED" ? "red" : "blue"}>
                      {sessionStatusLabels[it.status]}
                    </Badge>
                  </Td>
                  <Td>
                    {it.status === "SCHEDULED" && (
                      <Button variant="secondary" onClick={() => holdMutation.mutate(it.id)} disabled={holdMutation.isPending}>
                        Отметить проведённой
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {createOpen && <CreateIndividualModal onClose={() => setCreateOpen(false)} onCreated={() => query.refetch()} />}
    </div>
  );
}
