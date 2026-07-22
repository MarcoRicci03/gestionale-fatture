import type { Metadata } from "next";
import { getPayers, getArchivedPayers } from "@/lib/data/payers";
import { PayersManager } from "@/components/payers/payers-manager";

export const metadata: Metadata = {
  title: "Paganti",
};

export default async function PayersPage() {
  const [payers, archivedPayers] = await Promise.all([
    getPayers(),
    getArchivedPayers(),
  ]);
  return <PayersManager payers={payers} archivedPayers={archivedPayers} />;
}
