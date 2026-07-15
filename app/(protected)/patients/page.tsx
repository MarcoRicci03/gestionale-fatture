import type { Metadata } from "next";
import { getPatients, getPayersForSelect } from "@/lib/data/patients";
import { PatientsManager } from "@/components/patients/patients-manager";

export const metadata: Metadata = {
  title: "Pazienti",
};

export default async function PatientsPage() {
  const [patients, payers] = await Promise.all([
    getPatients(),
    getPayersForSelect(),
  ]);

  return <PatientsManager patients={patients} payers={payers} />;
}
