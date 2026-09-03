import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { roleLabels } from "../lib/format";

const navItems = [
  { to: "/", label: "Дашборд", end: true },
  { to: "/athletes", label: "Спортсмены" },
  { to: "/leads", label: "Заявки" },
  { to: "/venues", label: "Площадки" },
  { to: "/groups", label: "Группы" },
  { to: "/schedule", label: "Расписание" },
  { to: "/attendance", label: "Посещаемость" },
  { to: "/finance", label: "Финансы", ownerOrAdminOnly: true },
  { to: "/mailings", label: "Рассылки" },
  { to: "/analytics", label: "Аналитика" },
  { to: "/employees", label: "Сотрудники", ownerOnly: true },
  { to: "/settings", label: "Настройки", ownerOnly: true },
];

export default function DesktopLayout() {
  const { session, logout } = useAuth();
  const role = session?.role;

  const items = navItems.filter((item) => {
    if (item.ownerOnly) return role === "OWNER";
    if (item.ownerOrAdminOnly) return role === "OWNER" || role === "ADMINISTRATOR";
    return true;
  });

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">Sports CRM</p>
          <p className="text-xs text-slate-500">{role && roleLabels[role]}</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-2">
          <button
            onClick={logout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Выйти
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden p-6">
        <Outlet />
      </main>
    </div>
  );
}
