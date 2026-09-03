import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Group, SportType, Venue } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Th,
  Tr,
} from "../../components/ui";

export default function GroupsList() {
  const { session } = useAuth();
  const canManage = session?.role === "OWNER" || session?.role === "ADMINISTRATOR";
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["groups"], queryFn: () => api.get<Group[]>("/groups") });

  return (
    <div>
      <PageHeader title="Группы" actions={canManage && <Button onClick={() => setCreateOpen(true)}>+ Группа</Button>} />
      <Card>
        {query.isLoading ? (
          <Spinner />
        ) : !query.data?.length ? (
          <EmptyState>Группы не найдены</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Название</Th>
                <Th>Площадка</Th>
                <Th>Вид спорта</Th>
                <Th>Тренеры</Th>
                <Th>Спортсмены</Th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((g) => (
                <Tr key={g.id}>
                  <Td className="font-medium text-slate-900">
                    <Link to={`/groups/${g.id}`} className="hover:underline">
                      {g.name}
                    </Link>
                  </Td>
                  <Td>{g.venue?.name}</Td>
                  <Td>{g.sportType?.name}</Td>
                  <Td>{g.coaches?.map((c) => c.employee.user.fullName).join(", ") || "—"}</Td>
                  <Td>
                    {g._count?.athleteGroups ?? 0}
                    {g.participantLimit ? ` / ${g.participantLimit}` : ""}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {createOpen && (
        <CreateGroupModal onClose={() => setCreateOpen(false)} onCreated={() => queryClient.invalidateQueries({ queryKey: ["groups"] })} />
      )}
    </div>
  );
}

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const venues = useQuery({ queryKey: ["venues"], queryFn: () => api.get<Venue[]>("/venues") });
  const sportTypes = useQuery({ queryKey: ["sport-types"], queryFn: () => api.get<SportType[]>("/settings/sport-types") });
  const [name, setName] = useState("");
  const [venueId, setVenueId] = useState("");
  const [sportTypeId, setSportTypeId] = useState("");
  const [participantLimit, setParticipantLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/groups", {
        name,
        venueId,
        sportTypeId,
        participantLimit: participantLimit ? Number(participantLimit) : undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать группу");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Новая группа" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Название">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Field label="Площадка">
          <Select value={venueId} onChange={(e) => setVenueId(e.target.value)} required>
            <option value="" disabled>
              Выберите площадку
            </option>
            {venues.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Вид спорта">
          <Select value={sportTypeId} onChange={(e) => setSportTypeId(e.target.value)} required>
            <option value="" disabled>
              Выберите вид спорта
            </option>
            {sportTypes.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Лимит участников (необязательно)">
          <Input type="number" min="1" value={participantLimit} onChange={(e) => setParticipantLimit(e.target.value)} />
        </Field>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving || !venueId || !sportTypeId}>
            {saving ? "Сохраняем…" : "Создать"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
