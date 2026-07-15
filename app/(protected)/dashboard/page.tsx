import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Riepilogo dello studio</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Fatturato Annuale</CardTitle>
            <CardDescription>Anno in corso</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-8 w-1/2 rounded bg-muted animate-pulse" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fatturato Mensile</CardTitle>
            <CardDescription>Mese in corso</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-8 w-1/2 rounded bg-muted animate-pulse" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ultime Fatture</CardTitle>
            <CardDescription>Ultimi documenti emessi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-8 w-2/3 rounded bg-muted animate-pulse" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
