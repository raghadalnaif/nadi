import { createHash } from "crypto";

// ═══════════════════════════════════════════════════════════
// الفوترة الإلكترونية — هيئة الزكاة والضريبة والدخل (ZATCA)
//
// المرحلة الأولى (التوليد): رمز QR بترميز TLV، ومستند بصيغة UBL 2.1.
// المرحلة الثانية (الربط): تضيف الختم التشفيري وسلسلة الهاش (PIH)
//   والعداد (ICV) — وهي منفَّذة هنا. أما التوقيع الإلكتروني (الوسوم
//   7-9 في QR) فيتطلب شهادة CSID تصدرها الهيئة بعد تسجيل المنشأة،
//   وتُضاف عند التكامل الفعلي مع بوابة «فاتورة».
// ═══════════════════════════════════════════════════════════

export const VAT_RATE = 0.15;

// السعر المعروض شامل الضريبة — نستخرج منه الأساس والضريبة
export function splitVat(totalWithVat: number) {
  const subtotal = totalWithVat / (1 + VAT_RATE);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vat: Math.round((totalWithVat - subtotal) * 100) / 100,
    total: Math.round(totalWithVat * 100) / 100,
  };
}

function tlv(tag: number, value: string) {
  const bytes = Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from([tag, bytes.length]), bytes]);
}

export type InvoiceParty = {
  name: string;
  vatNumber: string;
  crNumber?: string | null;
  address?: string | null;
};

export type InvoiceData = {
  number: string;
  uuid: string;
  issuedAt: Date;
  icv: number;
  pih: string;
  invoiceType: "simplified" | "standard";
  seller: InvoiceParty;
  buyerName?: string | null;
  buyerVat?: string | null;
  items: { description: string; qty: number; unitPriceSAR: number }[];
  subtotalSAR: number;
  vatSAR: number;
  totalSAR: number;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (n: number) => n.toFixed(2);

// مستند الفاتورة بصيغة UBL 2.1 المعتمدة من الهيئة
export function buildUBL(inv: InvoiceData) {
  const issueDate = inv.issuedAt.toISOString().slice(0, 10);
  const issueTime = inv.issuedAt.toISOString().slice(11, 19);
  // 0100000 = فاتورة ضريبية (B2B) | 0200000 = فاتورة مبسطة (B2C)
  const typeCode = inv.invoiceType === "standard" ? "0100000" : "0200000";

  const lines = inv.items
    .map((item, i) => {
      const lineTotal = item.qty * item.unitPriceSAR;
      const lineVat = lineTotal * VAT_RATE;
      return `    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${item.qty}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${money(lineTotal)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${money(lineVat)}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="SAR">${money(lineTotal + lineVat)}</cbc:RoundingAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${esc(item.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>15.00</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${money(item.unitPriceSAR)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
    })
    .join("\n");

  const buyerBlock =
    inv.invoiceType === "standard" && inv.buyerName
      ? `  <cac:AccountingCustomerParty>
    <cac:Party>
      ${inv.buyerVat ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(inv.buyerVat)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>` : ""}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(inv.buyerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${esc(inv.number)}</cbc:ID>
  <cbc:UUID>${inv.uuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${typeCode}">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${inv.icv}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${inv.pih}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${esc(inv.seller.crNumber ?? "")}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(inv.seller.address ?? "")}</cbc:StreetName>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(inv.seller.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(inv.seller.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
${buyerBlock}  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${money(inv.vatSAR)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${money(inv.subtotalSAR)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${money(inv.vatSAR)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${money(inv.subtotalSAR)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${money(inv.subtotalSAR)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${money(inv.totalSAR)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${money(inv.totalSAR)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines}
</Invoice>`;
}

// هاش الفاتورة (SHA-256 → Base64) — يدخل في سلسلة الترابط PIH
export function hashInvoice(xml: string) {
  return createHash("sha256").update(xml, "utf8").digest("base64");
}

// هاش البداية لأول فاتورة في السلسلة، حسب مواصفات الهيئة
export const GENESIS_PIH = Buffer.from("0").toString("base64");

// رمز QR — الوسوم 1-6 مولَّدة فعلياً، والوسوم 7-9 (التوقيع والمفتاح
// العام وختمه) تُضاف بعد استلام شهادة CSID من بوابة فاتورة.
export function zatcaQR(input: {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  totalWithVat: number;
  vatAmount: number;
  invoiceHash?: string;
}) {
  const parts = [
    tlv(1, input.sellerName),
    tlv(2, input.vatNumber),
    tlv(3, input.timestamp.toISOString()),
    tlv(4, input.totalWithVat.toFixed(2)),
    tlv(5, input.vatAmount.toFixed(2)),
  ];
  if (input.invoiceHash) parts.push(tlv(6, input.invoiceHash));
  return Buffer.concat(parts).toString("base64");
}

// يبني الفاتورة كاملة: XML + هاش + QR — نقطة واحدة تُستدعى من كل مكان
export function sealInvoice(inv: InvoiceData) {
  const xml = buildUBL(inv);
  const hash = hashInvoice(xml);
  const qrTLV = zatcaQR({
    sellerName: inv.seller.name,
    vatNumber: inv.seller.vatNumber,
    timestamp: inv.issuedAt,
    totalWithVat: inv.totalSAR,
    vatAmount: inv.vatSAR,
    invoiceHash: hash,
  });
  return { xml, hash, qrTLV };
}
