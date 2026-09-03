import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Athlete, Group } from "../../api/types";
import { Card, EmptyState, PageHeader, Spinner } from "../../components/ui";

export default function TrainerGroups() {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api.get<Group[]>("/groups") });

  return (
    <div>
      <PageHeader title="Мои группы" />
      {groups.isLoading ? (
        <Spinner />
      ) : !groups.data?.length ? (
        <EmptyState>Вы пока не назначены ни на одну группу</EmptyState>
      ) : (
        <div className="space-y-3">
          {groups.data.map((g) => (
            <Card key={g.id} className="p-4">
              <button className="flex w-full items-center justify-between text-left" onClick={() => setOpenGroupId(openGroupId === g.id ? null : g.id)}>
                <div>
                  <p className="font-medium text-slate-900">{g.name}</p>
                  <p className="text-xs text-slate-500">
                    {g.venue?.name} · {g._count?.athleteGroups ?? 0} спортсменов
                  </p>
                </div>
                <span className="text-slate-400">{openGroupId === g.id ? "▲" : "▼"}</span>
              </button>
              {openGroupId === g.id && <GroupRoster groupId={g.id} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupRoster({ groupId }: { groupId: string }) {
  const athletes = useQuery({ queryKey: ["athletes", { groupId }], queryFn: () => api.get<Athlete[]>(`/athletes?groupId=${groupId}`) });
  if (athletes.isLoading) return <Spinner />;
  if (!athletes.data?.length) return <EmptyState>В группе пока нет спортсменов</EmptyState>;
  return (
    <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-2 text-sm">
      {athletes.data.map((a) => (
        <li key={a.id} className="py-1.5 text-slate-700">
          {a.fullName}
        </li>
      ))}
    </ul>
  );
}
