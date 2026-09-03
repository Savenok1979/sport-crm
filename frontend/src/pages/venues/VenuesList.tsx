import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import type { Venue } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Button, Card, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, Spinner } from "../../components/ui";

export default function VenuesList() {
  const { session } = useAuth();
  const isOwner = session?.role === "OWNER";
  const [createOpen, setCreateOpen] = useState(false);
  const [zoneFor, setZoneFor] = useState<Venue | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["venues"], queryFn: () => api.get<Venue[]>("/venues") });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["venues"] });

  return (
    <div>
      <PageHeader title="Площадки" actions={isOwner && <Button onClick={() => setCreateOpen(true)}>+ Площадка</Button>} />

      {query.isLoading ? (
        <Spinner />
      ) : !query.data?.length ? (
        <EmptyState>Площадок пока нет</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {query.data.map((venue) => (
            <Card key={venue.id} className="p-4">
              <p className="font-medium text-slate-900">{venue.name}</p>
              <p className="text-sm text-slate-500">{venue.address || "Адрес не указан"}</p>
              <p className="mt-2 text-xs text-slate-400">Групп: {venue._count?.groups ?? 0}</p>
              {venue.zones.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">Залы: {venue.zones.map((z) => z.name).join(", ")}</p>
              )}
              <Button variant="ghost" className="mt-2 px-0" onClick={() => setZoneFor(venue)}>
                + Зал/зона
              </Button>
            </Card>
          ))}
        </div>
      )}

      {createOpen && <CreateVenueModal onClose={() => setCreateOpen(false)} onCreated={invalidate} />}
      {zoneFor && <AddZoneModal venue={zoneFor} onClose={() => setZoneFor(null)} onSaved={invalidate} />}
    </div>
  );
}

function CreateVenueModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/venues", { name, address: address || undefined });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать площадку");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Новая площадка" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Название">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Field label="Адрес">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
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

function AddZoneModal({ venue, onClose, onSaved }: { venue: Venue; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/venues/${venue.id}/zones`, { name });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить зону");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Новая зона — ${venue.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Название зала/зоны">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
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
