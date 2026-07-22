import type { Metadata } from "next";
import {
  getPatients,
  getPayersForSelect,
  getArchivedPatients,
} from "@/lib/data/patients";
import { PatientsManager } from "@/components/patients/patients-manager";

export const metadata: Metadata = {
  title: "Pazienti",
};

export default async function PatientsPage() {
  const [patients, payers, archivedPatients] = await Promise.all([
    getPatients(),
    getPayersForSelect(),
    getArchivedPatients(),
  ]);

  return (
    <PatientsManager
      patients={patients}
      payers={payers}
      archivedPatients={archivedPatients}
    />
  );
}
