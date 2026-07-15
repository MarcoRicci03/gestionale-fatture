import type { Metadata } from "next";
import { getUsers } from "@/lib/data/users";
import { UsersManager } from "@/components/users/users-manager";

export const metadata: Metadata = {
  title: "Utenti",
};

export default async function UsersPage() {
  const users = await getUsers();
  return <UsersManager users={users} />;
}
