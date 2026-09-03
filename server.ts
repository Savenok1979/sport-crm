import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { leadsRouter } from "./routes/leads";
import { athletesRouter } from "./routes/athletes";
import { groupsRouter } from "./routes/groups";
import { attendanceRouter } from "./routes/attendance";
import { financeRouter } from "./routes/finance";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Domains follow section 15's API list: auth, athletes, leads, venues, groups,
// sessions, attendance, finance, mailings, analytics, employees, settings.
// Only the MVP-spine domains are wired up here — see README "Next steps".
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/leads", leadsRouter);
app.use("/api/v1/athletes", athletesRouter);
app.use("/api/v1/groups", groupsRouter);
app.use("/api/v1/attendance", attendanceRouter);
app.use("/api/v1/finance", financeRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Sports CRM API listening on :${port}`));
