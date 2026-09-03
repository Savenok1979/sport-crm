import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { leadsRouter } from "./routes/leads";
import { athletesRouter } from "./routes/athletes";
import { venuesRouter } from "./routes/venues";
import { groupsRouter } from "./routes/groups";
import { sessionsRouter } from "./routes/sessions";
import { attendanceRouter } from "./routes/attendance";
import { financeRouter } from "./routes/finance";
import { mailingsRouter } from "./routes/mailings";
import { analyticsRouter } from "./routes/analytics";
import { employeesRouter } from "./routes/employees";
import { settingsRouter } from "./routes/settings";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Domains follow section 15's API list: auth, athletes, leads, venues, groups,
// sessions, attendance, finance, mailings, analytics, employees, settings.
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/leads", leadsRouter);
app.use("/api/v1/athletes", athletesRouter);
app.use("/api/v1/venues", venuesRouter);
app.use("/api/v1/groups", groupsRouter);
app.use("/api/v1/sessions", sessionsRouter);
app.use("/api/v1/attendance", attendanceRouter);
app.use("/api/v1/finance", financeRouter);
app.use("/api/v1/mailings", mailingsRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/employees", employeesRouter);
app.use("/api/v1/settings", settingsRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Sports CRM API listening on :${port}`));
