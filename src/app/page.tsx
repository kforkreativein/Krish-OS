import Shell from "@/components/Shell";
import OperatorCard from "@/components/dashboard/OperatorCard";
import FinancePulseCard from "@/components/dashboard/FinancePulseCard";
import KeyBlockersCard from "@/components/dashboard/KeyBlockersCard";
import SessionCard from "@/components/dashboard/SessionCard";
import HabitsCard from "@/components/dashboard/HabitsCard";
import CalendarCard from "@/components/dashboard/CalendarCard";
import NutritionCard from "@/components/dashboard/NutritionCard";
import GoalsCard from "@/components/dashboard/GoalsCard";
import OnePercentCard from "@/components/dashboard/OnePercentCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return (
    <Shell>
      <div className="home-dashboard">
        <div className="home-stack home-left">
          <OperatorCard />
          <FinancePulseCard />
          <KeyBlockersCard />
        </div>
        <div className="home-stack home-center">
          <SessionCard />
          <HabitsCard />
          <CalendarCard />
        </div>
        <div className="home-stack home-right">
          <GoalsCard />
          <OnePercentCard />
          <NutritionCard />
        </div>
      </div>
    </Shell>
  );
}
