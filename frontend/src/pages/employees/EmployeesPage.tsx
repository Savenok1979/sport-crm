import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import type { Employee, EmployeeRole, Venue } from "../../api/types";
import {
  Badge,
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
import { employeeStatusLabels, roleLabels } from "../../lib/format";

export default function EmployeesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [accessFor, setAccessFor] = useState<Employee | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["employees"], queryFn: () => api.get<Employee[]>("/employees") });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["employees"] });

  return (
    <div>
      <PageHeader title="Сотрудники" actions={<Button onClick={() => setCreateOpen(true)}>+ Сотрудник</Button>} />
      <Card>
        {query.isLoading ? (
          <Spinner />
        ) : !query.data?.length ? (
          <EmptyState>Сотрудников пока нет</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Имя</Th>
                <Th>E-mail</Th>
                <Th>Роль</Th>
                <Th>Статус</Th>
                <Th>Площадки</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {query.data.map((e) => (
                <Tr key={e.id}>
                  <Td className="font-medium text-slate-900">{e.user.fullName}</Td>
                  <Td>{e.user.email}</Td>
                  <Td>{roleLabels[e.role]}</Td>
                  <Td>
                    <Badge tone={e.status === "ACTIVE" ? "green" : "slate"}>{employeeStatusLabels[e.status]}</Badge>
                  </Td>
                  <Td>{e.venueAccess.map((v) => v.venue.name).join(", ") || (e.role === "OWNER" ? "Все" : "—")}</Td>
                  <Td>
                    {e.role === "ADMINISTRATOR" && (
                      <Button variant="ghost" onClick={() => setAccessFor(e)}>
                        Площадки
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {createOpen && <CreateEmployeeModal onClose={() => setCreateOpen(false)} onCreated={invalidate} />}
      {accessFor && <VenueAccessModal employee={accessFor} onClose={() => setAccessFor(null)} onSaved={invalidate} />}
    </div>
  );
}

function CreateEmployeeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<EmployeeRole>("TRAINER");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/employees", { email, fullName, password, role });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить сотрудника");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Новый сотрудник" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="ФИО">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Пароль">
          <Input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label="Роль">
          <Select value={role} onChange={(e) => setRole(e.target.value as EmployeeRole)}>
            <option value="ADMINISTRATOR">Администратор</option>
            <option value="TRAINER">Тренер</option>
            <option value="OWNER">Владелец</option>
          </Select>
        </Field>
        <p className="text-xs text-slate-400">Передайте пароль сотруднику лично — приглашения по e-mail пока нет.</p>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Сохраняем…" : "Добавить"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function VenueAccessModal({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => void }) {
  const venues = useQuery({ queryKey: ["venues"], queryFn: () => api.get<Venue[]>("/venues") });
  const [selected, setSelected] = useState<Set<string>>(new Set(employee.venueAccess.map((v) => v.venueId)));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/employees/${employee.id}/venue-access`, { venueIds: [...selected] });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить доступ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Площадки — ${employee.user.fullName}`} onClose={onClose}>
      <div className="space-y-2">
        {venues.data?.map((v) => (
          <label key={v.id} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} />
            {v.name}
          </label>
        ))}
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
