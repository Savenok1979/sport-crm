import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/today", label: "Сегодня", icon: "📋" },
  { to: "/my-groups", label: "Группы", icon: "👥" },
  { to: "/my-schedule", label: "Расписание", icon: "📅" },
  { to: "/more", label: "Ещё", icon: "⋯" },
];

export default function MobileLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <main className="flex-1 overflow-y-auto p-4 pb-20">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-slate-200 bg-white">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                isActive ? "text-slate-900" : "text-slate-400"
              }`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
