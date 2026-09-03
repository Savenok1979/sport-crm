import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import type { Lead, LeadStage } from "../../api/types";
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
import { formatDate, leadStageLabels } from "../../lib/format";

const stageOptions = Object.keys(leadStageLabels) as LeadStage[];
const stageTone: Record<LeadStage, "blue" | "amber" | "green" | "red" | "slate"> = {
  NEW: "blue",
  TRIAL_SCHEDULED: "amber",
  TRIAL_ATTENDED: "amber",
  ENROLLED: "green",
  NO_SHOW: "red",
  REJECTED: "red",
  WAITLIST: "slate",
};

export default function LeadsList() {
  const [stage, setStage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["leads", stage],
    queryFn: () => api.get<Lead[]>(`/leads${stage ? `?stage=${stage}` : ""}`),
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, newStage }: { id: string; newStage: LeadStage }) => api.patch(`/leads/${id}/stage`, { stage: newStage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  return (
    <div>
      <PageHeader
        title="Заявки"
        actions={<Button onClick={() => setCreateOpen(true)}>+ Новая заявка</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={stage} onChange={(e) => setStage(e.target.value)} className="max-w-xs">
          <option value="">Все этапы</option>
          {stageOptions.map((s) => (
            <option key={s} value={s}>
              {leadStageLabels[s]}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {query.isLoading ? (
          <Spinner />
        ) : !query.data?.length ? (
          <EmptyState>Заявок нет</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ребёнок</Th>
                <Th>Родитель</Th>
                <Th>Телефон</Th>
                <Th>Этап</Th>
                <Th>Ответственный</Th>
                <Th>Создана</Th>
                <Th>Действие</Th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((lead) => (
                <Tr key={lead.id}>
                  <Td className="font-medium text-slate-900">{lead.childFullName}</Td>
                  <Td>{lead.parentName || "—"}</Td>
                  <Td>{lead.phone || "—"}</Td>
                  <Td>
                    <Badge tone={stageTone[lead.stage]}>{leadStageLabels[lead.stage]}</Badge>
                  </Td>
                  <Td>{lead.responsibleEmployee?.user.fullName || "—"}</Td>
                  <Td>{formatDate(lead.createdAt)}</Td>
                  <Td>
                    <Select
                      value={lead.stage}
                      onChange={(e) => stageMutation.mutate({ id: lead.id, newStage: e.target.value as LeadStage })}
                      className="py-1 text-xs"
                    >
                      {stageOptions.map((s) => (
                        <option key={s} value={s}>
                          {leadStageLabels[s]}
                        </option>
                      ))}
                    </Select>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {createOpen && (
        <CreateLeadModal onClose={() => setCreateOpen(false)} onCreated={() => queryClient.invalidateQueries({ queryKey: ["leads"] })} />
      )}
    </div>
  );
}

function CreateLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [childFullName, setChildFullName] = useState("");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/leads", { childFullName, parentName: parentName || undefined, phone: phone || undefined, source: source || undefined });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать заявку");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Новая заявка" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="ФИО ребёнка">
          <Input value={childFullName} onChange={(e) => setChildFullName(e.target.value)} required autoFocus />
        </Field>
        <Field label="Имя родителя">
          <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
        </Field>
        <Field label="Телефон">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Источник">
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="сайт, инстаграм, рекомендация…" />
        </Field>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Сохраняем…" : "Создать"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
