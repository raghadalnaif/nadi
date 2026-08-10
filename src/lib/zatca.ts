// توليد رمز QR للفاتورة الإلكترونية بصيغة هيئة الزكاة والضريبة والدخل (ZATCA)
// المرحلة الأولى: ترميز TLV لخمسة حقول إلزامية ثم Base64.

function tlv(tag: number, value: string) {
  const bytes = Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from([tag, bytes.length]), bytes]);
}

export function zatcaQR(input: {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  totalWithVat: number;
  vatAmount: number;
}) {
  return Buffer.concat([
    tlv(1, input.sellerName),
    tlv(2, input.vatNumber),
    tlv(3, input.timestamp.toISOString()),
    tlv(4, input.totalWithVat.toFixed(2)),
    tlv(5, input.vatAmount.toFixed(2)),
  ]).toString("base64");
}

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
