import type { Metadata } from "next";
import { getPayers, getArchivedPayers } from "@/lib/data/payers";
import { PayersManager } from "@/components/payers/payers-manager";
import { parsePayerListQuery } from "@/lib/validations/payer-list-query";

export const metadata: Metadata = {
  title: "Paganti",
};

export default async function PayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const { search, page, archivedPage } = parsePayerListQuery(rawParams);

  const [{ payers, totalCount, page: currentPage }, archived] =
    await Promise.all([
      getPayers(search, page),
      getArchivedPayers(search, archivedPage),
    ]);

  return (
    <PayersManager
      payers={payers}
      totalCount={totalCount}
      page={currentPage}
      archivedPayers={archived.payers}
      archivedTotalCount={archived.totalCount}
      archivedPage={archived.page}
      search={search}
    />
  );
}
