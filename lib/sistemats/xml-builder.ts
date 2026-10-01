import JSZip from "jszip";
import { encryptRsaPkcs1 } from "./crypto";
import { formatDateInput } from "@/lib/utils/date";
import type { SpesaSanitariaPayload } from "./types";

const MAX_ZIP_SIZE_BYTES = 5 * 1024 * 1024; // Limite Sogei 5 MB

export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

/**
 * Costruisce l'XML conforme alle specifiche v2.5 per il Sistema Tessera Sanitaria (730_precompilata.xsd).
 * Cifra automaticamente il CF del proprietario e dei cittadini con la chiave pubblica RSA (PKCS#1 v1.5 Base64).
 */
export function buildSistemaTsXml(
  payload: SpesaSanitariaPayload,
  certPath?: string
): string {
  const parts: string[] = [];

  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push(
    '<precompilata xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="730_precompilata.xsd">'
  );

  // Sezione <proprietario>
  parts.push("  <proprietario>");
  if (payload.proprietario.codiceRegione) {
    parts.push(
      `    <codiceRegione>${escapeXml(
        payload.proprietario.codiceRegione.padStart(3, "0")
      )}</codiceRegione>`
    );
  }
  if (payload.proprietario.codiceAsl) {
    parts.push(
      `    <codiceAsl>${escapeXml(
        payload.proprietario.codiceAsl.padStart(3, "0")
      )}</codiceAsl>`
    );
  }
  if (payload.proprietario.codiceStruttura) {
    parts.push(
      `    <codiceSSA>${escapeXml(payload.proprietario.codiceStruttura)}</codiceSSA>`
    );
  }

  const cfProp = payload.proprietario.cfProprietario;
  const cfPropCifrato =
    cfProp && cfProp.length <= 16 ? encryptRsaPkcs1(cfProp, certPath) : cfProp;
  parts.push(`    <cfProprietario>${escapeXml(cfPropCifrato)}</cfProprietario>`);
  parts.push("  </proprietario>");

  // Sezione <documentoSpesa>
  for (const doc of payload.documenti) {
    parts.push("  <documentoSpesa>");
    parts.push("    <idSpesa>");
    parts.push(`      <pIva>${escapeXml(doc.idSpesa.pIva)}</pIva>`);
    parts.push(
      `      <dataEmissione>${formatDateInput(doc.idSpesa.dataEmissione)}</dataEmissione>`
    );
    parts.push("      <numDocumentoFiscale>");
    parts.push(
      `        <dispositivo>${doc.idSpesa.dispositivo ?? 1}</dispositivo>`
    );
    parts.push(
      `        <numDocumento>${escapeXml(doc.idSpesa.numDocumento)}</numDocumento>`
    );
    parts.push("      </numDocumentoFiscale>");
    parts.push("    </idSpesa>");

    parts.push(
      `    <dataPagamento>${formatDateInput(doc.dataPagamento)}</dataPagamento>`
    );
    parts.push(`    <flagOperazione>${doc.flagOperazione ?? "I"}</flagOperazione>`);

    // <cfCittadino> cifrato (da omettere per normativa ministeriale se flagOpposizione === 1)
    if (doc.flagOpposizione !== 1) {
      const cfCittadino = doc.cfCittadino
        ? encryptRsaPkcs1(doc.cfCittadino, certPath)
        : "";
      if (cfCittadino) {
        parts.push(`    <cfCittadino>${escapeXml(cfCittadino)}</cfCittadino>`);
      }
    }

    parts.push(
      `    <pagamentoTracciato>${doc.pagamentoTracciato}</pagamentoTracciato>`
    );
    parts.push(`    <tipoDocumento>${doc.tipoDocumento ?? "F"}</tipoDocumento>`);
    parts.push(
      `    <flagOpposizione>${doc.flagOpposizione ?? 0}</flagOpposizione>`
    );

    // <voceSpesa>
    for (const voce of doc.vociSpesa) {
      parts.push("    <voceSpesa>");
      parts.push(`      <tipoSpesa>${escapeXml(voce.tipoSpesa)}</tipoSpesa>`);
      parts.push(`      <importo>${voce.importo.toFixed(2)}</importo>`);
      parts.push(`      <naturaIVA>${escapeXml(voce.naturaIva || "N2.2")}</naturaIVA>`);
      parts.push("    </voceSpesa>");
    }

    parts.push("  </documentoSpesa>");
  }

  parts.push("</precompilata>\n");

  return parts.join("\n");
}

/**
 * Comprime l'XML in un archivio ZIP in-memory conforme a Sogei (compressione DEFLATE, max 5 MB).
 */
export async function createZipArchive(
  xmlString: string,
  xmlFilename: string = "730.xml"
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(xmlFilename, xmlString, {
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  if (zipBuffer.length > MAX_ZIP_SIZE_BYTES) {
    throw new Error(
      `L'archivio ZIP supera il limite consentito di 5 MB: ${zipBuffer.length} bytes > ${MAX_ZIP_SIZE_BYTES} bytes.`
    );
  }

  return zipBuffer;
}
