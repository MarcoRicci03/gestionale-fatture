import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { resolvePlaceholders } from "@/lib/pdf/placeholders";
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
            const text = resolvePlaceholders(
              (blocco.testo ?? "").replace(/\t/g, "    "),
              invoice
            );

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

            return (
              <View key={blocco.id} style={containerStyle}>
                <Text
                  style={{
                    ...textStyle,
                    textAlign: blocco.align,
                  }}
                >
                  {text.split("\n").flatMap((line, lineIndex) => {
                    const segments = parseInlineFormatting(line);
                    return [
                      ...(lineIndex > 0 ? ["\n"] : []),
                      ...segments.map((segment, segIndex) => (
                        <Text
                          key={`${lineIndex}-${segIndex}`}
                          style={{
                            fontFamily: getFontFamily(settings.fontFamily, {
                              bold:
                                blocco.fontWeight === "bold" || segment.bold,
                              italic: segment.italic,
                            }),
                            color: segment.gray
                              ? "#9ca3af"
                              : textStyle.color,
                          }}
                        >
                          {segment.text}
                        </Text>
                      )),
                    ];
                  })}
                </Text>
              </View>
            );
          })}
      </Page>
    </Document>
  );
}
