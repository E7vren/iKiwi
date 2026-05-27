import { Resend } from "resend";

const resend =
  process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes("your_")
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const FROM = process.env.RESEND_FROM ?? "noreply@ikiwi.uz";

function formatUZS(amount: number) {
  return `${Math.round(amount).toLocaleString("ru-RU")} UZS`;
}

export async function sendNewOrderEmail(params: {
  adminEmail: string;
  shopName: string;
  orderId: string;
  itemCount: number;
  estimatedTotal: number;
}) {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: params.adminEmail,
      subject: `🛒 New order from ${params.shopName}`,
      html: `
        <h2>New order received</h2>
        <p><strong>${params.shopName}</strong> placed an order with ${params.itemCount} items.</p>
        <p>Estimated total: <strong>${formatUZS(params.estimatedTotal)}</strong></p>
        <p>Order ID: <code>${params.orderId}</code></p>
      `,
    });
  } catch (err) {
    console.error("[Email] sendNewOrderEmail failed:", err);
  }
}

export async function sendStaffCredentialsEmail(params: {
  staffEmail: string;
  staffName: string;
  password: string;
}) {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: params.staffEmail,
      subject: "🚗 Your iKiwi Driver Account",
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <div style="background:#16a34a;padding:24px;border-radius:12px 12px 0 0">
            <h1 style="color:white;margin:0;font-size:20px">iKiwi — Driver Account Created</h1>
          </div>
          <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
            <p>Hi <strong>${params.staffName}</strong>,</p>
            <p>Your iKiwi driver account is ready. Use these credentials to log in:</p>
            <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb">
              <p style="margin:0 0 8px;font-size:14px"><strong>Email:</strong> ${params.staffEmail}</p>
              <p style="margin:0;font-size:14px"><strong>Password:</strong>
                <code style="background:#e5e7eb;padding:2px 8px;border-radius:4px;font-size:13px">${params.password}</code>
              </p>
            </div>
            <p style="color:#6b7280;font-size:12px;margin-top:16px">
              Please log in at <strong>ikiwi.uz/login</strong> and change your password.
            </p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error("[Email] sendStaffCredentialsEmail failed:", err);
  }
}

export async function sendActualCostEmail(params: {
  shopOwnerEmail: string;
  shopName: string;
  orderId: string;
  actualTotal: number;
  items: Array<{
    name: string;
    unit: string;
    actualQty: number;
    lineTotal: number;
    note: string | null;
  }>;
}) {
  if (!resend) return;
  try {
    const rows = params.items
      .map(
        (i) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${i.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${i.actualQty} ${i.unit}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${formatUZS(i.lineTotal)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px">${i.note ?? ""}</td>
        </tr>`
      )
      .join("");

    await resend.emails.send({
      from: FROM,
      to: params.shopOwnerEmail,
      subject: "✅ Your iKiWi order is ready",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#16a34a;padding:24px;border-radius:12px 12px 0 0">
            <h1 style="color:white;margin:0;font-size:20px">🥬 iKiWi — Order Ready</h1>
          </div>
          <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
            <p>Hi <strong>${params.shopName}</strong>, your order is ready for pickup or delivery!</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <thead>
                <tr style="background:#f9fafb">
                  <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280">Product</th>
                  <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280">Qty</th>
                  <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280">Total</th>
                  <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280">Note</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
              <tfoot>
                <tr style="background:#f0fdf4">
                  <td colspan="3" style="padding:12px;font-weight:700">Final Total</td>
                  <td style="padding:12px;font-weight:700;color:#16a34a;text-align:right">${formatUZS(params.actualTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <p style="color:#6b7280;font-size:12px">Order ID: <code>${params.orderId}</code></p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error("[Email] sendActualCostEmail failed:", err);
  }
}
