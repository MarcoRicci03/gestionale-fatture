import type { Metadata } from "next";
import {
  getPatients,
  getPayersForSelect,
  getArchivedPatients,
} from "@/lib/data/patients";
import { PatientsManager } from "@/components/patients/patients-manager";
import { parsePatientListQuery } from "@/lib/validations/patient-list-query";

export const metadata: Metadata = {
  title: "Pazienti",
};

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const { search, page, archivedPage, pageSize } = parsePatientListQuery(rawParams);

  const [{ patients, totalCount, page: currentPage }, payers, archived] =
    await Promise.all([
      getPatients(search, page, pageSize),
      getPayersForSelect(),
      getArchivedPatients(search, archivedPage, pageSize),
    ]);

  return (
    <PatientsManager
      patients={patients}
      totalCount={totalCount}
      page={currentPage}
      pageSize={pageSize}
      payers={payers}
      archivedPatients={archived.patients}
      archivedTotalCount={archived.totalCount}
      archivedPage={archived.page}
      search={search}
    />
  );
}

