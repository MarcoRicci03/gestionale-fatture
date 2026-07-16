import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getPdfSettings } from "@/lib/data/settings";
import { PdfEditor } from "@/components/settings/pdf-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Impostazioni PDF",
};

export default async function PdfSettingsPage() {
  const session = await requireSession();
  const settings = await getPdfSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Impostazioni PDF</h1>
        <p className="text-muted-foreground">
          Personalizza layout, posizionamento e stile delle tue fatture.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Layout fattura</CardTitle>
          <CardDescription>
            Le modifiche si applicano ai nuovi PDF. Le fatture già scaricate
            mantengono il layout al momento del download. Puoi aggiornare il
            layout di una singola fattura dalla lista fatture.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PdfEditor initialSettings={settings} userId={session.id} />
        </CardContent>
      </Card>
    </div>
  );
}
