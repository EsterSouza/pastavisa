import type { Metadata } from "next";
import { CommercialPlanner } from "@/components/commercial-planner/CommercialPlanner";

export const metadata: Metadata = {
  title: "Pré-planejamento comercial | Pasta Sanitária",
  description: "Monte o pré-planejamento comercial da Pasta Sanitária e baixe o PDF provisório.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function PlannerPage() {
  return <CommercialPlanner />;
}
