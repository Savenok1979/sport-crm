import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { AthletesAnalytics, AttendanceAnalytics, FinanceAnalytics, FunnelAnalytics } from "../api/types";
import { Card, PageHeader, Spinner } from "../components/ui";
import { formatMoney } from "../lib/format";
import { useAuth } from "../auth/AuthContext";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

export default function Dashboard() {
  const { session } = useAuth();
  const canSeeFinance = session?.role === "OWNER" || session?.role === "ADMINISTRATOR";

  const athletes = useQuery({
    queryKey: ["analytics", "athletes"],
    queryFn: () => api.get<AthletesAnalytics>("/analytics/athletes"),
  });
  const attendance = useQuery({
    queryKey: ["analytics", "attendance"],
    queryFn: () => api.get<AttendanceAnalytics>("/analytics/attendance"),
  });
  const finance = useQuery({
    queryKey: ["analytics", "finance"],
    queryFn: () => api.get<FinanceAnalytics>("/analytics/finance"),
    enabled: canSeeFinance,
  });
  const funnel = useQuery({
    queryKey: ["analytics", "funnel"],
    queryFn: () => api.get<FunnelAnalytics>("/analytics/funnel"),
  });

  if (athletes.isLoading || attendance.isLoading || funnel.isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Дашборд" subtitle="Текущий месяц" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Активные спортсмены" value={String(athletes.data?.active ?? 0)} />
        <Stat label="Новые" value={String(athletes.data?.new ?? 0)} />
        <Stat label="Выбывшие" value={String(athletes.data?.left ?? 0)} />
        <Stat label="На паузе" value={String(athletes.data?.paused ?? 0)} />
        <Stat
          label="Средняя посещаемость"
          value={attendance.data?.averageRate != null ? `${attendance.data.averageRate}%` : "—"}
        />
        <Stat label="Незаполненная посещаемость" value={String(attendance.data?.unfilledSessions ?? 0)} />
        {canSeeFinance && (
          <>
            <Stat label="Начислено" value={finance.data ? formatMoney(finance.data.accrued) : "—"} />
            <Stat
              label="Собираемость"
              value={finance.data?.collectabilityPct != null ? `${finance.data.collectabilityPct}%` : "—"}
              hint={finance.data ? `Долг: ${formatMoney(finance.data.debt)}` : undefined}
            />
          </>
        )}
        <Stat label="Заявки за период" value={String(funnel.data?.total ?? 0)} />
        <Stat
          label="Конверсия в зачисление"
          value={funnel.data?.conversionToEnrolledPct != null ? `${funnel.data.conversionToEnrolledPct}%` : "—"}
        />
      </div>

      {attendance.data && (attendance.data.bestGroups.length > 0 || attendance.data.worstGroups.length > 0) && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Лучшие группы по посещаемости</p>
            <ul className="space-y-1 text-sm">
              {attendance.data.bestGroups.map((g) => (
                <li key={g.groupId} className="flex justify-between">
                  <span className="text-slate-600">{g.name}</span>
                  <span className="font-medium">{g.rate != null ? `${g.rate}%` : "—"}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Требуют внимания</p>
            <ul className="space-y-1 text-sm">
              {attendance.data.worstGroups.map((g) => (
                <li key={g.groupId} className="flex justify-between">
                  <span className="text-slate-600">{g.name}</span>
                  <span className="font-medium">{g.rate != null ? `${g.rate}%` : "—"}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
