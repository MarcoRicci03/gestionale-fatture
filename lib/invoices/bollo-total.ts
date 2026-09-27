// ARCH-06: Riferimento centralizzato nel modulo di dominio @/lib/fiscal/bollo.
// Questo file viene mantenuto per retrocompatibilità verso i moduli preesistenti.
export {
  getBolloImporto,
  getTotaleConBollo,
  calcolaTotaliFattura,
  isBolloDovuto,
  isBolloApplicato,
  isBolloCodiceValido,
} from "@/lib/fiscal/bollo";
export type { TotaliFattura } from "@/lib/fiscal/bollo";
