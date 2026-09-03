import { PageHeader } from "../../components/ui";
import TodaySessions from "../attendance/TodaySessions";

export default function TrainerToday() {
  return (
    <div>
      <PageHeader title="Сегодня" />
      <TodaySessions />
    </div>
  );
}
