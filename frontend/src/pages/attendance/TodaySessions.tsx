import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { AttendanceStatus, TrainingSession } from "../../api/types";
import { Badge, Button, Card, EmptyState, Spinner } from "../../components/ui";
import { formatDateTime, sessionStatusLabels } from "../../lib/format";

// Shared by the admin "Посещаемость" overview and the trainer "Сегодня"
// screen (section 7.4 mobile flow): both are the same underlying data.
export default function TodaySessions() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["attendance", "today"], queryFn: () => api.get<TrainingSession[]>("/attendance/today") });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["attendance", "today"] });

  if (query.isLoading) return <Spinner />;
  if (!query.data?.length) return <EmptyState>На сегодня тренировок нет</EmptyState>;

  return (
    <div className="space-y-4">
      {query.data.map((session) => (
        <SessionCard key={session.id} session={session} onChanged={invalidate} />
      ))}
    </div>
  );
}

function SessionCard({ session, onChanged }: { session: TrainingSession; onChanged: () => void }) {
  const [entries, setEntries] = useState<Record<string, AttendanceStatus | undefined>>(() =>
    Object.fromEntries((session.attendances ?? []).map((a) => [a.athleteId, a.status ?? undefined]))
  );

  const markMutation = useMutation({
    mutationFn: (payload: { athleteId: string; status: AttendanceStatus }[]) =>
      api.post(`/attendance/sessions/${session.id}/mark`, { entries: payload }),
    onSuccess: onChanged,
  });
  const completeMutation = useMutation({
    mutationFn: () => api.post(`/attendance/sessions/${session.id}/complete`),
    onSuccess: onChanged,
  });

  const setStatus = (athleteId: string, status: AttendanceStatus) => {
    const next = { ...entries, [athleteId]: status };
    setEntries(next);
    markMutation.mutate([{ athleteId, status }]);
  };

  const markAllPresent = () => {
    const all = (session.attendances ?? []).map((a) => ({ athleteId: a.athleteId, status: "PRESENT" as const }));
    const next = Object.fromEntries(all.map((a) => [a.athleteId, a.status]));
    setEntries(next);
    markMutation.mutate(all);
  };

  const locked = session.status === "CANCELLED";

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{session.group.name}</p>
          <p className="text-xs text-slate-500">
            {formatDateTime(session.startsAt)} · {session.venue.name}
          </p>
        </div>
        <Badge tone={session.status === "HELD" ? "green" : session.status === "CANCELLED" ? "red" : "blue"}>
          {sessionStatusLabels[session.status]}
        </Badge>
      </div>

      {locked ? (
        <p className="text-sm text-slate-400">Тренировка отменена: {session.cancelReason}</p>
      ) : !session.attendances?.length ? (
        <EmptyState>В этой тренировке пока нет спортсменов</EmptyState>
      ) : (
        <>
          <div className="mb-2">
            <Button variant="secondary" onClick={markAllPresent} disabled={markMutation.isPending}>
              Отметить всех «Был»
            </Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {session.attendances.map((a) => {
              const status = entries[a.athleteId] ?? a.status;
              return (
                <li key={a.athleteId} className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-800">{a.athlete.fullName}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setStatus(a.athleteId, "PRESENT")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        status === "PRESENT" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      Был
                    </button>
                    <button
                      onClick={() => setStatus(a.athleteId, "ABSENT")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        status === "ABSENT" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      Не был
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {session.status !== "HELD" && (
            <div className="mt-3 text-right">
              <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
                Завершить
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
