import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import type { Organization, SportType, Tariff } from "../../api/types";
import { Button, Card, EmptyState, ErrorBanner, Field, Input, PageHeader, Spinner, Table, Td, Th, Tr } from "../../components/ui";
import { formatMoney } from "../../lib/format";

const tabs = ["Организация", "Виды спорта", "Тарифы"] as const;
type Tab = (typeof tabs)[number];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Организация");
  return (
    <div>
      <PageHeader title="Настройки" />
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
      {tab === "Организация" && <OrganizationTab />}
      {tab === "Виды спорта" && <SportTypesTab />}
      {tab === "Тарифы" && <TariffsTab />}
    </div>
  );
}

function OrganizationTab() {
  const query = useQuery({ queryKey: ["settings", "organization"], queryFn: () => api.get<Organization>("/settings/organization") });
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [currency, setCurrency] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) {
      setName(query.data.name);
      setTimezone(query.data.timezone);
      setCurrency(query.data.currency);
    }
  }, [query.data]);

  if (query.isLoading) return <Spinner />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch("/settings/organization", { name, timezone, currency });
      query.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-md space-y-3 p-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Название организации">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Часовой пояс">
          <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </Field>
        <Field label="Валюта">
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </Field>
        {error && <ErrorBanner message={error} />}
        <Button type="submit" disabled={saving}>
          {saving ? "Сохраняем…" : "Сохранить"}
        </Button>
      </form>
    </Card>
  );
}

function SportTypesTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["sport-types"], queryFn: () => api.get<SportType[]>("/settings/sport-types") });
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/settings/sport-types", { name });
      setName("");
      queryClient.invalidateQueries({ queryKey: ["sport-types"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить");
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id: string) => {
    await api.post(`/settings/sport-types/${id}/archive`);
    queryClient.invalidateQueries({ queryKey: ["sport-types"] });
  };

  return (
    <div className="max-w-md space-y-4">
      <form onSubmit={onAdd} className="flex items-end gap-2">
        <Field label="Новый вид спорта">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Button type="submit" disabled={saving}>
          Добавить
        </Button>
      </form>
      {error && <ErrorBanner message={error} />}
      <Card>
        {!query.data?.length ? (
          <EmptyState>Видов спорта пока нет</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {query.data.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
                {s.name}
                <Button variant="ghost" onClick={() => archive(s.id)}>
                  Архивировать
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function TariffsTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["tariffs"], queryFn: () => api.get<Tariff[]>("/settings/tariffs") });
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    const minorUnits = Math.round(Number(price) * 100);
    if (!minorUnits || minorUnits <= 0) {
      setError("Введите цену больше нуля");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/settings/tariffs", { name, price: minorUnits });
      setName("");
      setPrice("");
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить тариф");
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id: string) => {
    await api.post(`/settings/tariffs/${id}/archive`);
    queryClient.invalidateQueries({ queryKey: ["tariffs"] });
  };

  return (
    <div className="max-w-lg space-y-4">
      <form onSubmit={onAdd} className="flex items-end gap-2">
        <Field label="Название тарифа">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Цена, ₽">
          <Input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
        <Button type="submit" disabled={saving}>
          Добавить
        </Button>
      </form>
      {error && <ErrorBanner message={error} />}
      <Card>
        {!query.data?.length ? (
          <EmptyState>Тарифов пока нет</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Название</Th>
                <Th>Цена</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {query.data.map((t) => (
                <Tr key={t.id}>
                  <Td className="font-medium text-slate-900">{t.name}</Td>
                  <Td>{formatMoney(t.price)}</Td>
                  <Td>
                    <Button variant="ghost" onClick={() => archive(t.id)}>
                      Архивировать
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
