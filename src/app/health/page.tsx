import Shell from "@/components/Shell";
import GoalsCard from "@/components/dashboard/GoalsCard";
import HabitsCard from "@/components/dashboard/HabitsCard";
import NutritionCard from "@/components/dashboard/NutritionCard";
import OnePercentCard from "@/components/dashboard/OnePercentCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HealthPage() {
  return (
    <Shell>
      <div className="health-dashboard">
        <div className="health-stack health-main">
          <NutritionCard />
        </div>
        <div className="health-stack health-side">
          <HabitsCard />
          <OnePercentCard />
          <GoalsCard />
        </div>
      </div>
    </Shell>
  );
}
