import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { Athlete } from "../../api/types";
import { Badge, Card, EmptyState, Input, PageHeader, Select, Spinner, Table, Td, Th, Tr } from "../../components/ui";
import { athleteStatusLabels } from "../../lib/format";
import QuickAddAthleteModal from "./QuickAddAthleteModal";

const statusTones: Record<string, "green" | "amber" | "red" | "slate"> = {
  ACTIVE: "green",
  PENDING_SETUP: "amber",
  PAUSED: "slate",
  LEFT: "red",
};

export default function AthletesList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const query = useQuery({
    queryKey: ["athletes", { search, status }],
    queryFn: () =>
      api.get<Athlete[]>(`/athletes?${new URLSearchParams({ ...(search ? { search } : {}), ...(status ? { status } : {}) })}`),
  });

  return (
    <div>
      <PageHeader
        title="Спортсмены"
        actions={
          <button onClick={() => setQuickAddOpen(true)} className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700">
            + Добавить
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Поиск по ФИО" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-xs">
          <option value="">Все статусы</option>
          {Object.entries(athleteStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {query.isLoading ? (
          <Spinner />
        ) : !query.data?.length ? (
          <EmptyState>Спортсмены не найдены</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>ФИО</Th>
                <Th>Статус</Th>
                <Th>Группы</Th>
                <Th>Дата начала</Th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((athlete) => (
                <Tr key={athlete.id}>
                  <Td className="font-medium text-slate-900">
                    <Link to={`/athletes/${athlete.id}`} className="hover:underline">
                      {athlete.fullName}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={statusTones[athlete.status] ?? "slate"}>{athleteStatusLabels[athlete.status]}</Badge>
                  </Td>
                  <Td>{athlete.athleteGroups.map((ag) => ag.group.name).join(", ") || "—"}</Td>
                  <Td>{athlete.startDate ? new Date(athlete.startDate).toLocaleDateString("ru-RU") : "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {quickAddOpen && <QuickAddAthleteModal onClose={() => setQuickAddOpen(false)} onCreated={() => query.refetch()} />}
    </div>
  );
}
