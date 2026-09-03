import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import type { TrainingSession } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Spinner, Table, Td, Th, Tr, Button } from "../../components/ui";
import { formatDateTime, sessionStatusLabels } from "../../lib/format";

const statusTone: Record<string, "blue" | "green" | "red"> = { SCHEDULED: "blue", HELD: "green", CANCELLED: "red" };

export default function ScheduleView() {
  const { session } = useAuth();
  const canManage = session?.role === "OWNER" || session?.role === "ADMINISTRATOR";
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({ queryKey: ["sessions"], queryFn: () => api.get<TrainingSession[]>("/sessions") });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/sessions/${id}/cancel`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось отменить тренировку"),
  });

  const onCancel = (s: TrainingSession) => {
    const reason = window.prompt("Причина отмены (форс-мажор)?");
    if (!reason) return;
    setError(null);
    cancelMutation.mutate({ id: s.id, reason });
  };

  return (
    <div>
      <PageHeader title="Расписание" subtitle="Текущий месяц" />
      {error && <div className="mb-3">
        <ErrorBanner message={error} />
      </div>}
      <Card>
        {query.isLoading ? (
          <Spinner />
        ) : !query.data?.length ? (
          <EmptyState>Тренировок пока нет — сгенерируйте их из правила расписания на странице группы</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Дата и время</Th>
                <Th>Группа</Th>
                <Th>Площадка</Th>
                <Th>Статус</Th>
                {canManage && <Th />}
              </tr>
            </thead>
            <tbody>
              {query.data.map((s) => (
                <Tr key={s.id}>
                  <Td>{formatDateTime(s.startsAt)}</Td>
                  <Td className="font-medium text-slate-900">{s.group.name}</Td>
                  <Td>{s.venue.name}</Td>
                  <Td>
                    <Badge tone={statusTone[s.status]}>{sessionStatusLabels[s.status]}</Badge>
                  </Td>
                  {canManage && (
                    <Td>
                      {s.status === "SCHEDULED" && (
                        <Button variant="ghost" onClick={() => onCancel(s)}>
                          Отменить
                        </Button>
                      )}
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
