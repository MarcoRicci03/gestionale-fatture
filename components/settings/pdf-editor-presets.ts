import {
  CalendarDays,
  Type,
  User,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";
import type { MeseConfig, TipoBlocco } from "@/lib/pdf/types";

export const DEFAULT_MESE_CONFIG: MeseConfig = {
  titolo: "Dettaglio mesi",
  descrizioneTemplate: "{{riga.meseLabel}}",
  valoreTemplate: "{{riga.prezzo}}",
  mostraTotale: true,
  totaleLabel: "Totale",
};

export const PRESETS: Record<
  TipoBlocco,
  { label: string; icon: React.ElementType; defaultText?: string }
> = {
  mittente: {
    label: "Mittente",
    icon: UserCircle,
    defaultText:
      "Mittente\n{{mittente.titoloNomeCognomeSpec}}\n{{mittente.via}}\n{{mittente.cittaProvincia}}\nCF: {{mittente.cf}}\nP.IVA: {{mittente.pIva}}",
  },
  intestatario: {
    label: "Intestatario",
    icon: User,
    defaultText:
      "Intestatario fattura (Pagante)\n{{intestatario.cognomeNome}}\n{{intestatario.via}}\n{{intestatario.capCitta}}\nCF: {{intestatario.cf}}\nP.IVA: {{intestatario.piva}}",
  },
  paziente: {
    label: "Paziente",
    icon: Users,
    defaultText: "Paziente\n{{paziente.cognomeNome}}",
  },
  pagamento: {
    label: "Pagamento",
    icon: Wallet,
    defaultText:
      "Dettagli pagamento\nImporto totale:\t{{fattura.prezzoTotale}}\nModalità:\t{{fattura.modalitaPagamento}}\nN. sedute:\t{{fattura.sedute}}\nNote:\t{{fattura.commento}}",
  },
  testo: {
    label: "Testo libero",
    icon: Type,
    defaultText: "Testo libero",
  },
  mesi: {
    label: "Mesi/Voci",
    icon: CalendarDays,
  },
};
