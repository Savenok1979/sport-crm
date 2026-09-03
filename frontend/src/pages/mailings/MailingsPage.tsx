import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import type { CommunicationLog, Group, MailingScopeType, MessageTemplate, SportType, Venue } from "../../api/types";
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
  Textarea,
  Th,
  Tr,
} from "../../components/ui";
import { communicationStatusLabels, formatDateTime } from "../../lib/format";

const tabs = ["Шаблоны", "Отправить", "История"] as const;
type Tab = (typeof tabs)[number];

export default function MailingsPage() {
  const [tab, setTab] = useState<Tab>("Шаблоны");
  return (
    <div>
      <PageHeader title="Рассылки" />
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
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
      {tab === "Шаблоны" && <TemplatesTab />}
      {tab === "Отправить" && <SendTab />}
      {tab === "История" && <HistoryTab />}
    </div>
  );
}

function TemplatesTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["templates"], queryFn: () => api.get<MessageTemplate[]>("/mailings/templates") });

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>+ Шаблон</Button>
      </div>
      <Card>
        {query.isLoading ? (
          <Spinner />
        ) : !query.data?.length ? (
          <EmptyState>Шаблонов пока нет</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {query.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{t.name}</p>
                  <p className="line-clamp-1 text-xs text-slate-500">{t.body}</p>
                </div>
                <Button variant="ghost" onClick={() => setPreviewId(t.id)}>
                  Предпросмотр
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {createOpen && (
        <CreateTemplateModal onClose={() => setCreateOpen(false)} onCreated={() => query.refetch()} />
      )}
      {previewId && <PreviewModal templateId={previewId} onClose={() => setPreviewId(null)} />}
    </div>
  );
}

function CreateTemplateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/mailings/templates", { name, subject: subject || undefined, body });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать шаблон");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Новый шаблон" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Название">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Field label="Тема письма">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Текст">
          <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} required />
        </Field>
        <p className="text-xs text-slate-400">
          Переменные: {"{athlete} {group} {venue} {coach} {amount} {debt} {period} {due_date}"}
        </p>
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

function PreviewModal({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["template-preview", templateId],
    queryFn: () => api.post<{ subject: string | null; body: string }>(`/mailings/templates/${templateId}/preview`, {}),
  });
  return (
    <Modal title="Предпросмотр" onClose={onClose}>
      {query.isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-2 text-sm">
          {query.data?.subject && <p className="font-medium text-slate-900">{query.data.subject}</p>}
          <p className="whitespace-pre-wrap text-slate-600">{query.data?.body}</p>
        </div>
      )}
    </Modal>
  );
}

function SendTab() {
  const { session } = useAuth();
  const role = session?.role;
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => api.get<MessageTemplate[]>("/mailings/templates") });
  const venues = useQuery({ queryKey: ["venues"], queryFn: () => api.get<Venue[]>("/venues"), enabled: role !== "TRAINER" });
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api.get<Group[]>("/groups") });
  const sportTypes = useQuery({ queryKey: ["sport-types"], queryFn: () => api.get<SportType[]>("/settings/sport-types"), enabled: role === "OWNER" });

  const scopeOptions: { value: MailingScopeType; label: string }[] =
    role === "OWNER"
      ? [
          { value: "ORGANIZATION", label: "Вся организация" },
          { value: "VENUE", label: "Площадка" },
          { value: "SPORT", label: "Вид спорта" },
          { value: "GROUP", label: "Группа" },
        ]
      : role === "ADMINISTRATOR"
        ? [
            { value: "VENUE", label: "Площадка" },
            { value: "GROUP", label: "Группа" },
          ]
        : [{ value: "GROUP", label: "Моя группа" }];

  const [templateId, setTemplateId] = useState("");
  const [scopeType, setScopeType] = useState<MailingScopeType>(scopeOptions[0].value);
  const [scopeId, setScopeId] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const scopeChoices = scopeType === "VENUE" ? venues.data : scopeType === "SPORT" ? sportTypes.data : scopeType === "GROUP" ? groups.data : [];

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSending(true);
    try {
      const res = await api.post<{ recipientCount: number; athleteCount: number }>("/mailings", {
        templateId,
        scopeType,
        scopeId: scopeType === "ORGANIZATION" ? undefined : scopeId,
      });
      setResult(`Спортсменов в выборке: ${res.athleteCount}, получателей письма: ${res.recipientCount}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось отправить рассылку");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="max-w-lg p-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Шаблон">
          <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
            <option value="" disabled>
              Выберите шаблон
            </option>
            {templates.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Кому">
          <Select
            value={scopeType}
            onChange={(e) => {
              setScopeType(e.target.value as MailingScopeType);
              setScopeId("");
            }}
          >
            {scopeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        {scopeType !== "ORGANIZATION" && (
          <Field label="Уточнить">
            <Select value={scopeId} onChange={(e) => setScopeId(e.target.value)} required>
              <option value="" disabled>
                Выберите
              </option>
              {scopeChoices?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {error && <ErrorBanner message={error} />}
        {result && <p className="text-sm text-emerald-700">{result}</p>}
        <Button type="submit" disabled={sending || !templateId || (scopeType !== "ORGANIZATION" && !scopeId)}>
          {sending ? "Отправляем…" : "Отправить"}
        </Button>
      </form>
    </Card>
  );
}

function HistoryTab() {
  const query = useQuery({ queryKey: ["mailings", "history"], queryFn: () => api.get<CommunicationLog[]>("/mailings/history") });
  return (
    <Card>
      {query.isLoading ? (
        <Spinner />
      ) : !query.data?.length ? (
        <EmptyState>История пуста</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Дата</Th>
              <Th>Спортсмен</Th>
              <Th>Шаблон</Th>
              <Th>Статус</Th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((log) => (
              <Tr key={log.id}>
                <Td>{formatDateTime(log.sentAt)}</Td>
                <Td>{log.athlete?.fullName ?? "—"}</Td>
                <Td>{log.mailing?.template?.name ?? "—"}</Td>
                <Td>{communicationStatusLabels[log.status] ?? log.status}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
