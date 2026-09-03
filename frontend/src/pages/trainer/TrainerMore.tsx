import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Card, PageHeader } from "../../components/ui";
import { roleLabels } from "../../lib/format";

export default function TrainerMore() {
  const { session, logout } = useAuth();
  return (
    <div>
      <PageHeader title="Ещё" />
      <Card className="mb-4 p-4">
        <p className="text-sm text-slate-500">Вы вошли как</p>
        <p className="font-medium text-slate-900">{session && roleLabels[session.role]}</p>
      </Card>
      <div className="space-y-2">
        <Link to="/athletes" className="block rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
          Спортсмены
        </Link>
        <Link to="/mailings" className="block rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
          Сообщения моим группам
        </Link>
        <button
          onClick={logout}
          className="block w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
