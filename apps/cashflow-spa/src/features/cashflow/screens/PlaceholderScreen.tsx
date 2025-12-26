import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const PlaceholderScreen = ({ title }: { title: string }) => {
  return (
    <div className="space-y-5">
      <Button variant="ghost" className="px-0 text-slate-500 hover:text-slate-900" asChild>
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </Button>
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Coming soon</h1>
        <p className="mt-2 text-sm text-slate-600">We will migrate this module after cashflow is stable.</p>
      </Card>
    </div>
  );
};
