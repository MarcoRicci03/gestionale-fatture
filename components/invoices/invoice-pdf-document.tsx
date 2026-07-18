import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { resolvePlaceholders, renderMesiRows } from "@/lib/pdf/placeholders";
import { parseInlineFormatting } from "@/lib/pdf/formatting";
import type { PdfLayout, InvoiceWithRelations } from "@/lib/pdf/types";

type InvoicePDFDocumentProps = {
  invoice: InvoiceWithRelations;
  settings: PdfLayout;
};

function getFontFamily(
  base: string,
  { bold, italic }: { bold?: boolean; italic?: boolean }
) {
  const isBold = bold ?? false;
  const isItalic = italic ?? false;

  if (base === "Helvetica") {
    if (isBold && isItalic) return "Helvetica-BoldOblique";
    if (isBold) return "Helvetica-Bold";
    if (isItalic) return "Helvetica-Oblique";
    return "Helvetica";
  }
  if (base === "Times-Roman") {
    if (isBold && isItalic) return "Times-BoldItalic";
    if (isBold) return "Times-Bold";
    if (isItalic) return "Times-Italic";
    return "Times-Roman";
  }
  if (base === "Courier") {
    if (isBold && isItalic) return "Courier-BoldOblique";
    if (isBold) return "Courier-Bold";
    if (isItalic) return "Courier-Oblique";
    return "Courier";
  }
  if (isBold && isItalic) return `${base}-BoldItalic`;
  if (isBold) return `${base}-Bold`;
  if (isItalic) return `${base}-Italic`;
  return base;
}

function renderTextSegments(
  text: string,
  keyPrefix: string,
  fontFamilyBase: string,
  bold: boolean,
  color: string
) {
  return parseInlineFormatting(text).map((segment, segIndex) => (
    <Text
      key={`${keyPrefix}-${segIndex}`}
      style={{
        fontFamily: getFontFamily(fontFamilyBase, {
          bold: bold || segment.bold,
          italic: segment.italic,
        }),
        color: segment.gray ? "#9ca3af" : color,
      }}
    >
      {segment.text}
    </Text>
  ));
}

export function InvoicePDFDocument({
  invoice,
  settings,
}: InvoicePDFDocumentProps) {
  const pageStyle = StyleSheet.create({
    page: {
      width: settings.pageWidth,
      height: settings.pageHeight,
      paddingTop: settings.marginTop,
      paddingRight: settings.marginRight,
      paddingBottom: settings.marginBottom,
      paddingLeft: settings.marginLeft,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSizeBase,
      position: "relative",
    },
  }).page;

  return (
    <Document>
      <Page size={[settings.pageWidth, settings.pageHeight]} style={pageStyle}>
        {settings.blocchi
          .filter((b) => b.visible)
          .map((blocco) => {
            const textStyle = StyleSheet.create({
              base: {
                fontSize: blocco.fontSize,
                fontFamily: getFontFamily(settings.fontFamily, {
                  bold: blocco.fontWeight === "bold",
                }),
                color: blocco.color ?? "#000000",
                lineHeight: 1,
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
              },
            }).base;

            const containerStyle = StyleSheet.create({
              block: {
                position: "absolute",
                left: blocco.x,
                top: blocco.y,
                width: blocco.width,
                height: blocco.height,
                paddingTop: blocco.paddingTop ?? 0,
                paddingRight: blocco.paddingRight ?? 0,
                paddingBottom: blocco.paddingBottom ?? 0,
                paddingLeft: blocco.paddingLeft ?? 0,
              },
            }).block;

            if (blocco.tipo === "mesi" && blocco.meseConfig) {
              const rows = renderMesiRows(blocco.meseConfig, invoice);
              return (
                <View key={blocco.id} style={containerStyle}>
                  {blocco.meseConfig.titolo && (
                    <Text
                      style={{
                        ...textStyle,
                        fontFamily: getFontFamily(settings.fontFamily, {
                          bold: true,
                        }),
                      }}
                    >
                      {blocco.meseConfig.titolo}
                    </Text>
                  )}
                  {rows.map((row, rowIndex) => (
                    <View
                      key={rowIndex}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={textStyle}>
                        {renderTextSegments(
                          row.descrizione,
                          `d-${rowIndex}`,
                          settings.fontFamily,
                          blocco.fontWeight === "bold",
                          textStyle.color
                        )}
                      </Text>
                      <Text style={{ ...textStyle, textAlign: "right" }}>
                        {renderTextSegments(
                          row.valore,
                          `v-${rowIndex}`,
                          settings.fontFamily,
                          blocco.fontWeight === "bold",
                          textStyle.color
                        )}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            }

            const text = resolvePlaceholders(
              (blocco.testo ?? "").replace(/\t/g, "    "),
              invoice
            );

            return (
              <View key={blocco.id} style={containerStyle}>
                <Text
                  style={{
                    ...textStyle,
                    textAlign: blocco.align,
                  }}
                >
                  {text.split("\n").flatMap((line, lineIndex) => [
                    ...(lineIndex > 0 ? ["\n"] : []),
                    ...renderTextSegments(
                      line,
                      `${lineIndex}`,
                      settings.fontFamily,
                      blocco.fontWeight === "bold",
                      textStyle.color
                    ),
                  ])}
                </Text>
              </View>
            );
          })}
      </Page>
    </Document>
  );
}
