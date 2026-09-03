import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import type { TrainingSession } from "../../api/types";
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Spinner, Button } from "../../components/ui";
import { formatDateTime, sessionStatusLabels } from "../../lib/format";

const statusTone: Record<string, "blue" | "green" | "red"> = { SCHEDULED: "blue", HELD: "green", CANCELLED: "red" };

export default function TrainerSchedule() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["sessions"], queryFn: () => api.get<TrainingSession[]>("/sessions") });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/sessions/${id}/cancel`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось отменить тренировку"),
  });

  const onCancel = (id: string) => {
    const reason = window.prompt("Причина отмены (только форс-мажор)?");
    if (!reason) return;
    setError(null);
    cancelMutation.mutate({ id, reason });
  };

  return (
    <div>
      <PageHeader title="Расписание" subtitle="Мои тренировки" />
      {error && (
        <div className="mb-3">
          <ErrorBanner message={error} />
        </div>
      )}
      {query.isLoading ? (
        <Spinner />
      ) : !query.data?.length ? (
        <EmptyState>Тренировок пока нет</EmptyState>
      ) : (
        <div className="space-y-2">
          {query.data.map((s) => (
            <Card key={s.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{s.group.name}</p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(s.startsAt)} · {s.venue.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={statusTone[s.status]}>{sessionStatusLabels[s.status]}</Badge>
                {s.status === "SCHEDULED" && (
                  <Button variant="ghost" onClick={() => onCancel(s.id)}>
                    Отменить
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
