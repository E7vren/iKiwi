import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const GREEN = "#2E7D32";
const LIGHT_GREEN = "#E8F5E9";
const GREY = "#5F6368";
const LIGHT_GREY = "#F8F9FA";
const BORDER = "#DADCE0";
const BLACK = "#1A1A1A";

const s = StyleSheet.create({
  page:          { padding: 40, fontFamily: "Helvetica", backgroundColor: "#FFFFFF", fontSize: 10, color: BLACK },
  header:        { backgroundColor: GREEN, borderRadius: 8, padding: 20, marginBottom: 24, alignItems: "center" },
  logoText:      { color: "#FFFFFF", fontSize: 22, fontFamily: "Helvetica-Bold" },
  tagline:       { color: "#A5D6A7", fontSize: 9, marginTop: 3 },
  section:       { marginBottom: 16 },
  sectionTitle:  { fontSize: 8, fontFamily: "Helvetica-Bold", color: GREEN, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },
  card:          { borderRadius: 6, border: "1pt solid", borderColor: BORDER, padding: 12 },
  row:           { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label:         { color: GREY, fontSize: 9 },
  value:         { fontFamily: "Helvetica-Bold", fontSize: 9 },
  tableHeader:   { flexDirection: "row", backgroundColor: LIGHT_GREEN, padding: "6 8", borderRadius: 4, marginBottom: 2 },
  tableRow:      { flexDirection: "row", padding: "5 8", borderBottom: "0.5pt solid", borderBottomColor: BORDER },
  tableLastRow:  { flexDirection: "row", padding: "5 8" },
  col1:          { flex: 3 },
  col2:          { flex: 2, textAlign: "right" },
  col3:          { flex: 2, textAlign: "right" },
  thText:        { fontFamily: "Helvetica-Bold", fontSize: 8, color: GREEN },
  totalRow:      { flexDirection: "row", justifyContent: "space-between", padding: "8 0", borderTop: "1pt solid", borderTopColor: BORDER, marginTop: 4 },
  totalLabel:    { fontFamily: "Helvetica-Bold", fontSize: 11 },
  totalValue:    { fontFamily: "Helvetica-Bold", fontSize: 13, color: GREEN },
  note:          { backgroundColor: LIGHT_GREY, borderRadius: 4, padding: 8, marginTop: 8 },
  noteText:      { color: GREY, fontSize: 9 },
  footer:        { marginTop: 32, alignItems: "center", borderTop: "0.5pt solid", borderTopColor: BORDER, paddingTop: 12 },
  footerText:    { color: GREY, fontSize: 9, textAlign: "center", marginBottom: 2 },
  footerGreen:   { color: GREEN, fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  badge:         { backgroundColor: LIGHT_GREEN, color: GREEN, fontSize: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontFamily: "Helvetica-Bold" },
});

function formatNum(n: number): string {
  return Math.round(n).toLocaleString("en-US").replace(/,/g, " ") + " UZS";
}

function itemQty(item: {
  orderedAs: "KG" | "PIECE";
  requestedKg: number | null;
  requestedPieces: number | null;
  actualKg: number | null;
  actualPieces: number | null;
}): string {
  if (item.orderedAs === "KG") {
    const actual = item.actualKg ?? item.requestedKg;
    return actual != null ? `${actual} kg` : "—";
  }
  const actual = item.actualPieces ?? item.requestedPieces;
  return actual != null ? `${actual} pcs` : "—";
}

type ReceiptOrder = {
  id: string;
  status: string;
  createdAt: string | Date;
  estimatedTotal: number;
  actualTotal: number | null;
  notes: string | null;
  finalCostNote: string | null;
  shop: { name: string; ownerName: string; phone: string; address: string };
  items: Array<{
    id: string;
    orderedAs: "KG" | "PIECE";
    requestedKg: number | null;
    requestedPieces: number | null;
    actualKg: number | null;
    actualPieces: number | null;
    estimatedPrice: number;
    actualPrice: number | null;
    adminAdjusted: boolean;
    adminNote: string | null;
    product: { name: string };
  }>;
};

export function ReceiptDocument({ order }: { order: ReceiptOrder }) {
  const shortId = order.id.slice(-6).toUpperCase();
  const dateStr = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const total = order.actualTotal ?? order.estimatedTotal;
  const hasActual = order.actualTotal != null;

  return (
    <Document
      title={`iKiwi Receipt - Order #${shortId}`}
      author="iKiwi Fresh Produce"
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.logoText}>iKiwi</Text>
          <Text style={s.tagline}>Fresh Fruits & Vegetables · Tashkent, Uzbekistan</Text>
        </View>

        {/* Order meta */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Order Details</Text>
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.label}>Order Number</Text>
              <Text style={s.value}>#{shortId}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Date</Text>
              <Text style={s.value}>{dateStr}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Status</Text>
              <Text style={[s.value, { color: GREEN }]}>{order.status.replace(/_/g, " ")}</Text>
            </View>
            <View style={{ marginTop: 8, borderTop: "0.5pt solid", borderTopColor: BORDER, paddingTop: 8 }}>
              <View style={s.row}>
                <Text style={s.label}>Shop</Text>
                <Text style={s.value}>{order.shop.name}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.label}>Contact</Text>
                <Text style={s.value}>{order.shop.phone}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.label}>Address</Text>
                <Text style={s.value}>{order.shop.address}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Items</Text>
          <View style={s.tableHeader}>
            <Text style={[s.thText, s.col1]}>Product</Text>
            <Text style={[s.thText, s.col2]}>Quantity</Text>
            <Text style={[s.thText, s.col3]}>Price</Text>
          </View>
          {order.items.map((item, i) => {
            const isLast = i === order.items.length - 1;
            const rowStyle = isLast ? s.tableLastRow : s.tableRow;
            const price = item.actualPrice ?? item.estimatedPrice;
            return (
              <View key={item.id} style={rowStyle}>
                <Text style={[{ fontSize: 9 }, s.col1]}>
                  {item.product.name}
                  {item.adminAdjusted ? " *" : ""}
                </Text>
                <Text style={[{ fontSize: 9, textAlign: "right" }, s.col2]}>
                  {itemQty(item)}
                </Text>
                <Text style={[{ fontSize: 9, textAlign: "right" }, s.col3]}>
                  {formatNum(price)}
                </Text>
              </View>
            );
          })}

          {/* Totals */}
          {hasActual && (
            <View style={[s.row, { paddingTop: 8, paddingHorizontal: 8 }]}>
              <Text style={s.label}>Estimated Total</Text>
              <Text style={[s.label, { textDecoration: "line-through" }]}>
                {formatNum(order.estimatedTotal)}
              </Text>
            </View>
          )}
          <View style={[s.totalRow, { paddingHorizontal: 8 }]}>
            <Text style={s.totalLabel}>{hasActual ? "Final Total" : "Estimated Total"}</Text>
            <Text style={s.totalValue}>{formatNum(total)}</Text>
          </View>

          {/* Admin / customer notes */}
          {order.finalCostNote && (
            <View style={s.note}>
              <Text style={[s.noteText, { fontFamily: "Helvetica-Bold", marginBottom: 2 }]}>Staff note</Text>
              <Text style={s.noteText}>{order.finalCostNote}</Text>
            </View>
          )}
          {order.notes && (
            <View style={[s.note, { marginTop: 4 }]}>
              <Text style={[s.noteText, { fontFamily: "Helvetica-Bold", marginBottom: 2 }]}>Order notes</Text>
              <Text style={s.noteText}>{order.notes}</Text>
            </View>
          )}
          {order.items.some((i) => i.adminAdjusted) && (
            <Text style={[s.noteText, { marginTop: 6, paddingHorizontal: 8 }]}>
              * Price adjusted by iKiwi staff
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerGreen}>Thank you for choosing iKiwi!</Text>
          <Text style={s.footerText}>support@ikiwi.uz  ·  +998 90 123 45 67</Text>
          <Text style={s.footerText}>Tashkent, Uzbekistan</Text>
          <Text style={[s.footerText, { marginTop: 6, fontSize: 8, color: "#9E9E9E" }]}>
            This is an estimated receipt. Final amounts are confirmed upon delivery.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
