"use client";

import { useState } from "react";
import { PlusCircle, Pencil, KeyRound, Ban, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserForm } from "./user-form";
import { ResetPasswordForm } from "./reset-password-form";
import { Tooltip } from "@/components/ui/tooltip";
import { toggleUserEnabled } from "@/lib/actions/users";
import type { SafeUtente } from "@/lib/data/user-select";

type UsersManagerProps = {
  users: SafeUtente[];
};

export function UsersManager({ users }: UsersManagerProps) {
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SafeUtente | null>(null);
  const [resettingUser, setResettingUser] = useState<SafeUtente | null>(null);

  const handleOpenNew = () => {
    setEditingUser(null);
    setOpen(true);
  };

  const handleOpenEdit = (user: SafeUtente) => {
    setEditingUser(user);
    setOpen(true);
  };

  const handleSuccess = () => {
    setOpen(false);
    setEditingUser(null);
    setResettingUser(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utenti</h1>
          <p className="text-muted-foreground">
            Gestione account e permessi
          </p>
        </div>
        <Button onClick={handleOpenNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuovo utente
        </Button>
      </div>

      {users.length === 0 ? (
        <p className="text-muted-foreground">Nessun utente presente.</p>
      ) : (
        <>
          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ruolo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="w-48 text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>
                      {[user.nome, user.cognome].filter(Boolean).join(" ") || "-"}
                    </TableCell>
                    <TableCell>{user.isAdmin ? "Admin" : "Utente"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {user.abilitato ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" /> Abilitato
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <Ban className="h-4 w-4" /> Disabilitato
                          </span>
                        )}
                        {user.mustChangePassword && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <KeyRound className="h-3.5 w-3.5" /> Password temporanea
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <Tooltip content="Reset password">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setResettingUser(user)}
                          aria-label="Reset password"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Modifica utente">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(user)}
                          aria-label="Modifica utente"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <form
                        action={async () => {
                          await toggleUserEnabled(user.id, !user.abilitato);
                        }}
                      >
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className={user.abilitato ? "text-destructive" : "text-green-600"}
                        >
                          {user.abilitato ? "Disabilita" : "Abilita"}
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 md:hidden">
            {users.map((user) => (
              <li key={user.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{user.username}</p>
                    <p className="text-sm text-muted-foreground">
                      {[user.nome, user.cognome].filter(Boolean).join(" ") || "-"}
                    </p>
                  </div>
                  {user.abilitato ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" /> Abilitato
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-destructive">
                      <Ban className="h-4 w-4" /> Disabilitato
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Ruolo: {user.isAdmin ? "Admin" : "Utente"}
                </p>
                {user.mustChangePassword && (
                  <p className="inline-flex items-center gap-1 text-xs text-amber-600">
                    <KeyRound className="h-3.5 w-3.5" /> Password temporanea
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1 border-t pt-3">
                  <Tooltip content="Reset password">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setResettingUser(user)}
                      aria-label="Reset password"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Modifica utente">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(user)}
                      aria-label="Modifica utente"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <form
                    action={async () => {
                      await toggleUserEnabled(user.id, !user.abilitato);
                    }}
                  >
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className={user.abilitato ? "text-destructive" : "text-green-600"}
                    >
                      {user.abilitato ? "Disabilita" : "Abilita"}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Modifica Utente" : "Nuovo Utente"}
            </DialogTitle>
          </DialogHeader>
          <UserForm user={editingUser ?? undefined} onSuccess={handleSuccess} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resettingUser}
        onOpenChange={(isOpen) => !isOpen && setResettingUser(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          {resettingUser && (
            <ResetPasswordForm
              userId={resettingUser.id}
              onSuccess={handleSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
