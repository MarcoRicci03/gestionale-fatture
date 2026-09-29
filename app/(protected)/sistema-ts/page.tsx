import type { Metadata } from "next";
import {
  getFatturePerInvioTs,
  getSistemaTsSettings,
  getStoricoTrasmissioniTs,
} from "@/lib/data/sistema-ts";
import { SistemaTsManager } from "@/components/sistema-ts/sistema-ts-manager";
import { parseSistemaTsListQuery } from "@/lib/validations/sistema-ts-list-query";

export const metadata: Metadata = {
  title: "Sistema TS — Invio Spese Sanitarie",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SistemaTsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = parseSistemaTsListQuery(await searchParams);

  const [settings, fatture, trasmissioni] = await Promise.all([
    getSistemaTsSettings(),
    getFatturePerInvioTs({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      stato: params.stato || "DA_INVIARE",
    }),
    getStoricoTrasmissioniTs(),
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
