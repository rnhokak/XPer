import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground">Update preferences, API keys, and integrations here.</CardContent>
    </Card>
  );
}
