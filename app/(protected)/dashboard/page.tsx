import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAnnualRevenue, getMonthlyRevenue } from "@/lib/data/invoices";

export const metadata: Metadata = {
  title: "Dashboard",
};

function formatCurrency(amount: number) {
  return amount.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
}

export default async function DashboardPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [annualRevenue, monthlyRevenue] = await Promise.all([
    getAnnualRevenue(currentYear),
    getMonthlyRevenue(currentYear, currentMonth),
  ]);

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
            <p className="text-2xl font-bold">{formatCurrency(annualRevenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fatturato Mensile</CardTitle>
            <CardDescription>Mese in corso</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(monthlyRevenue)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
