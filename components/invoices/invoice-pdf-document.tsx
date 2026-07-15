import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatDateDisplay } from "@/lib/utils/date";
import type { FatturaMese, Pagamento, Pagante, Paziente } from "@prisma/client";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    fontFamily: "Helvetica-Bold",
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  total: {
    marginTop: 20,
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
});

type InvoiceWithRelations = Pagamento & {
  pagante: Pagante;
  paziente: Paziente;
  mesi: FatturaMese[];
};

export function InvoicePDFDocument({
  invoice,
}: {
  invoice: InvoiceWithRelations;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Fattura n. {invoice.n_fattura}</Text>

        <View style={styles.section}>
          <Text>Data: {formatDateDisplay(invoice.data)}</Text>
          <Text>
            Mesi di riferimento:{" "}
            {invoice.mesi.map((m) => m.mese).join(", ")}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Intestatario fattura (Pagante)</Text>
          <Text>
            {invoice.pagante.cognome} {invoice.pagante.nome}
          </Text>
          <Text>{invoice.pagante.via}</Text>
          <Text>
            {invoice.pagante.cap} {invoice.pagante.citta}
          </Text>
          {invoice.pagante.cf && <Text>CF: {invoice.pagante.cf}</Text>}
          {invoice.pagante.piva && <Text>P.IVA: {invoice.pagante.piva}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Paziente</Text>
          <Text>
            {invoice.paziente.cognome} {invoice.paziente.nome}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Dettagli pagamento</Text>
          <View style={styles.row}>
            <Text>Importo totale:</Text>
            <Text>
              {invoice.prezzo_totale.toLocaleString("it-IT", {
                style: "currency",
                currency: "EUR",
              })}
            </Text>
          </View>
          <View style={styles.row}>
            <Text>Modalità:</Text>
            <Text>{invoice.mod_pag}</Text>
          </View>
          {invoice.sedute != null && (
            <View style={styles.row}>
              <Text>N. sedute:</Text>
              <Text>{invoice.sedute}</Text>
            </View>
          )}
          {invoice.commento && (
            <View style={styles.row}>
              <Text>Note:</Text>
              <Text>{invoice.commento}</Text>
            </View>
          )}
        </View>

        <Text style={styles.total}>
          Totale fattura:{" "}
          {invoice.prezzo_totale.toLocaleString("it-IT", {
            style: "currency",
            currency: "EUR",
          })}
        </Text>
      </Page>
    </Document>
  );
}
