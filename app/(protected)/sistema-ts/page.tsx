import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import {
  getFatturePerInvioTs,
  getSistemaTsSettings,
  getStoricoTrasmissioniTs,
} from "@/lib/data/sistema-ts";
import { SistemaTsManager } from "@/components/sistema-ts/sistema-ts-manager";

export const metadata: Metadata = {
  title: "Sistema TS — Invio Spese Sanitarie",
};

type SearchParams = Promise<{
  dateFrom?: string;
  dateTo?: string;
  stato?: string;
}>;

export default async function SistemaTsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const [settings, fatture, trasmissioni] = await Promise.all([
    getSistemaTsSettings(session.id),
    getFatturePerInvioTs(session.id, {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      stato: params.stato || "DA_INVIARE",
    }),
    getStoricoTrasmissioniTs(session.id),
  ]);

  return (
    <SistemaTsManager
      fatture={fatture}
      trasmissioni={trasmissioni}
      hasSettings={!!(settings && settings.hasPassword && settings.hasPincode)}
      filters={{
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        stato: params.stato,
      }}
    />
  );
}
