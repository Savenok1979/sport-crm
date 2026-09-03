import { PageHeader } from "../../components/ui";
import TodaySessions from "./TodaySessions";

export default function AttendanceOverview() {
  return (
    <div>
      <PageHeader title="Посещаемость" subtitle="Сегодня" />
      <TodaySessions />
    </div>
  );
}
