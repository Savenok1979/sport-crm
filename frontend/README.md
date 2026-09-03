# Sports CRM — frontend

React + Vite + TypeScript SPA for the Sports CRM backend. See the repository
root `README.md` for the full picture (backend, PRD, run instructions).

```bash
npm install
npm run dev      # http://localhost:5173, proxies /api to :4000
npm run build
```

Two layouts, chosen by role from the JWT (see `src/App.tsx`):
- Desktop (`src/layouts/DesktopLayout.tsx`) — Owner/Administrator.
- Mobile PWA (`src/layouts/MobileLayout.tsx`) — Trainer.
