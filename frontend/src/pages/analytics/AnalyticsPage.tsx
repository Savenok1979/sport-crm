import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../../api/client";
import type {
  AthletesAnalytics,
  AttendanceAnalytics,
  CoachAnalyticsRow,
  FinanceAnalytics,
  FunnelAnalytics,
} from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Card, EmptyState, PageHeader, Spinner, Table, Td, Th, Tr } from "../../components/ui";
import { formatMoney, leadStageLabels } from "../../lib/format";

const tabs = ["Спортсмены", "Посещаемость", "Финансы", "Воронка", "Тренеры"] as const;
type Tab = (typeof tabs)[number];

export default function AnalyticsPage() {
  const { session } = useAuth();
  const canSeeFinance = session?.role === "OWNER" || session?.role === "ADMINISTRATOR";
  const [tab, setTab] = useState<Tab>("Спортсмены");
  const visibleTabs = tabs.filter((t) => t !== "Финансы" || canSeeFinance);

  return (
    <div>
      <PageHeader title="Аналитика" subtitle="Текущий месяц" />
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
      {tab === "Спортсмены" && <AthletesTab />}
      {tab === "Посещаемость" && <AttendanceTab />}
      {tab === "Финансы" && canSeeFinance && <FinanceTab />}
      {tab === "Воронка" && <FunnelTab />}
      {tab === "Тренеры" && <CoachesTab />}
    </div>
  );
}

function StatRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((i) => (
        <Card key={i.label} className="p-4">
          <p className="text-xs font-medium text-slate-500">{i.label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{i.value}</p>
        </Card>
      ))}
    </div>
  );
}

function AthletesTab() {
  const q = useQuery({ queryKey: ["analytics", "athletes"], queryFn: () => api.get<AthletesAnalytics>("/analytics/athletes") });
  if (q.isLoading) return <Spinner />;
  if (!q.data) return null;
  return (
    <StatRow
      items={[
        { label: "Активные", value: String(q.data.active) },
        { label: "Новые", value: String(q.data.new) },
        { label: "Выбывшие", value: String(q.data.left) },
        { label: "На паузе", value: String(q.data.paused) },
      ]}
    />
  );
}

function AttendanceTab() {
  const q = useQuery({ queryKey: ["analytics", "attendance"], queryFn: () => api.get<AttendanceAnalytics>("/analytics/attendance") });
  if (q.isLoading) return <Spinner />;
  if (!q.data) return null;
  const chartData = [...q.data.bestGroups.map((g) => ({ name: g.name, rate: g.rate ?? 0 }))];
  return (
    <div className="space-y-4">
      <StatRow
        items={[
          { label: "Средняя посещаемость", value: q.data.averageRate != null ? `${q.data.averageRate}%` : "—" },
          { label: "Незаполненная посещаемость", value: String(q.data.unfilledSessions) },
        ]}
      />
      {chartData.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">Посещаемость по группам</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis unit="%" tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="rate" fill="#0f172a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

function FinanceTab() {
  const q = useQuery({ queryKey: ["analytics", "finance"], queryFn: () => api.get<FinanceAnalytics>("/analytics/finance") });
  if (q.isLoading) return <Spinner />;
  if (!q.data) return null;
  return (
    <div className="space-y-4">
      <StatRow
        items={[
          { label: "Начислено", value: formatMoney(q.data.accrued) },
          { label: "Оплачено", value: formatMoney(q.data.paid) },
          { label: "Долг", value: formatMoney(q.data.debt) },
          { label: "Собираемость", value: q.data.collectabilityPct != null ? `${q.data.collectabilityPct}%` : "—" },
        ]}
      />
      <Card className="p-4">
        <p className="mb-2 text-sm font-medium text-slate-700">Aging долга</p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-slate-500">1–7 дней</p>
            <p className="font-medium">{formatMoney(q.data.aging["1-7"])}</p>
          </div>
          <div>
            <p className="text-slate-500">8–30 дней</p>
            <p className="font-medium">{formatMoney(q.data.aging["8-30"])}</p>
          </div>
          <div>
            <p className="text-slate-500">30+ дней</p>
            <p className="font-medium">{formatMoney(q.data.aging["30+"])}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function FunnelTab() {
  const q = useQuery({ queryKey: ["analytics", "funnel"], queryFn: () => api.get<FunnelAnalytics>("/analytics/funnel") });
  if (q.isLoading) return <Spinner />;
  if (!q.data) return null;
  return (
    <div className="space-y-4">
      <StatRow
        items={[
          { label: "Заявок", value: String(q.data.total) },
          { label: "Конверсия в зачисление", value: q.data.conversionToEnrolledPct != null ? `${q.data.conversionToEnrolledPct}%` : "—" },
        ]}
      />
      <Card className="p-4">
        <p className="mb-2 text-sm font-medium text-slate-700">По этапам</p>
        {Object.keys(q.data.byStage).length === 0 ? (
          <EmptyState>Нет данных за период</EmptyState>
        ) : (
          <ul className="space-y-1 text-sm">
            {Object.entries(q.data.byStage).map(([stage, count]) => (
              <li key={stage} className="flex justify-between text-slate-600">
                <span>{leadStageLabels[stage] ?? stage}</span>
                <span className="font-medium">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CoachesTab() {
  const q = useQuery({ queryKey: ["analytics", "coaches"], queryFn: () => api.get<{ coaches: CoachAnalyticsRow[] }>("/analytics/coaches") });
  if (q.isLoading) return <Spinner />;
  const rows = q.data?.coaches ?? [];
  return (
    <Card>
      {!rows.length ? (
        <EmptyState>Нет данных о тренерах</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Тренер</Th>
              <Th>Группы</Th>
              <Th>Спортсмены</Th>
              <Th>Проведено</Th>
              <Th>Отменено</Th>
              <Th>Посещаемость</Th>
              <Th>Своевременность</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.employeeId}>
                <Td className="font-medium text-slate-900">{r.name}</Td>
                <Td>{r.groupCount}</Td>
                <Td>{r.athleteCount}</Td>
                <Td>{r.sessionsHeld}</Td>
                <Td>{r.sessionsCancelled}</Td>
                <Td>{r.averageAttendancePct != null ? `${r.averageAttendancePct}%` : "—"}</Td>
                <Td>{r.attendanceTimelinessPct != null ? `${r.attendanceTimelinessPct}%` : "—"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
