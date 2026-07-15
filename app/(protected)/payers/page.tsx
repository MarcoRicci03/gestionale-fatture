import type { Metadata } from "next";
import { getPayers } from "@/lib/data/payers";
import { PayersManager } from "@/components/payers/payers-manager";

export const metadata: Metadata = {
  title: "Paganti",
};

export default async function PayersPage() {
  const payers = await getPayers();
  return <PayersManager payers={payers} />;
}
