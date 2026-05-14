import "server-only";

import type { OrderRecord } from "@/lib/orderStore";

const businessName = "Dormside Eats";
const supportEmail = "dormsideeats@gmail.com";
const receiptPrefix = "DS";

type ReceiptLineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

const parsePrice = (price: string) =>
  Number(price.replace(/[^0-9.]/g, "")) || 0;

const formatMoney = (value: number) => `$${value.toFixed(2)}`;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const escapeHtml = (value: string | number) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizePdfText = (value: string | number) =>
  String(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "?")
    .trim();

const escapePdfText = (value: string | number) =>
  normalizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const getReceiptNumber = (order: OrderRecord) =>
  `${receiptPrefix}-${order.id.slice(0, 8).toUpperCase()}`;

const getLineItems = (order: OrderRecord): ReceiptLineItem[] =>
  order.items.map((item) => {
    const unitPrice = parsePrice(item.price);
    return {
      name: item.name,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
    };
  });

const getSubtotal = (order: OrderRecord) =>
  getLineItems(order).reduce((sum, item) => sum + item.lineTotal, 0);

const getPaymentLabel = (order: OrderRecord) =>
  order.paymentMethod === "cash" ? "Cash" : "Card";

const getFulfillmentLabel = (order: OrderRecord) =>
  order.fulfillment === "delivery" ? "Delivery" : "Pickup";

const getStatusLabel = (order: OrderRecord) => {
  if (order.status === "paid") {
    return "Paid";
  }
  if (order.status === "cash_pending") {
    return "Awaiting cash payment";
  }
  return "Payment pending";
};

const getTotalLabel = (order: OrderRecord) =>
  order.status === "paid" ? "Total paid" : "Total due";

const wrapText = (value: string, maxLength: number) => {
  const words = normalizePdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length > maxLength) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
};

export const getReceiptFilename = (
  order: OrderRecord,
  extension: "html" | "pdf",
) => `dormside-receipt-${getReceiptNumber(order).toLowerCase()}.${extension}`;

export const buildReceiptHtml = (order: OrderRecord) => {
  const receiptNumber = getReceiptNumber(order);
  const lineItems = getLineItems(order);
  const subtotal = getSubtotal(order);

  const rows = lineItems
    .map(
      (item) => `
        <tr>
          <td>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${item.quantity} x ${formatMoney(item.unitPrice)}</span>
          </td>
          <td>${item.quantity}</td>
          <td>${formatMoney(item.unitPrice)}</td>
          <td>${formatMoney(item.lineTotal)}</td>
        </tr>
      `,
    )
    .join("");

  const deliveryAddress =
    order.fulfillment === "delivery" && order.customer.address.trim()
      ? `<p><span>Delivery address</span>${escapeHtml(order.customer.address)}</p>`
      : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(businessName)} receipt ${escapeHtml(receiptNumber)}</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #111827;
        --muted: #6b7280;
        --line: #e5e7eb;
        --soft: #f8fafc;
        --accent: #047857;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #f3f4f6;
        color: var(--ink);
        font-family: Arial, Helvetica, sans-serif;
      }

      .page {
        margin: 32px auto;
        max-width: 820px;
        padding: 0 16px;
      }

      .receipt {
        background: #ffffff;
        border: 1px solid var(--line);
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
      }

      .header {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding: 36px;
        border-bottom: 1px solid var(--line);
      }

      .brand {
        margin: 0;
        font-size: 28px;
        line-height: 1.1;
      }

      .subtitle,
      .meta,
      .label,
      .footer,
      table span {
        color: var(--muted);
      }

      .subtitle {
        margin: 8px 0 0;
        font-size: 13px;
      }

      .total {
        text-align: right;
      }

      .total span {
        color: var(--muted);
        display: block;
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .total strong {
        display: block;
        font-size: 30px;
        margin-top: 6px;
      }

      .section {
        padding: 28px 36px;
        border-bottom: 1px solid var(--line);
      }

      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .field {
        border: 1px solid var(--line);
        padding: 14px 16px;
        background: var(--soft);
      }

      .field span,
      .summary span,
      .customer span {
        color: var(--muted);
        display: block;
        font-size: 11px;
        letter-spacing: 0.12em;
        margin-bottom: 5px;
        text-transform: uppercase;
      }

      .field strong,
      .customer p {
        font-size: 14px;
      }

      .customer {
        display: grid;
        gap: 18px;
        grid-template-columns: 1fr 1fr;
      }

      .customer p {
        margin: 0;
        line-height: 1.5;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th {
        color: var(--muted);
        font-size: 11px;
        letter-spacing: 0.12em;
        padding: 0 0 10px;
        text-align: right;
        text-transform: uppercase;
      }

      th:first-child,
      td:first-child {
        text-align: left;
      }

      td {
        border-top: 1px solid var(--line);
        font-size: 14px;
        padding: 14px 0;
        text-align: right;
        vertical-align: top;
      }

      table strong,
      table span {
        display: block;
      }

      table span {
        font-size: 12px;
        margin-top: 4px;
      }

      .summary {
        margin-left: auto;
        max-width: 320px;
      }

      .summary div {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding: 7px 0;
      }

      .summary .grand {
        border-top: 2px solid var(--ink);
        font-size: 18px;
        font-weight: 700;
        margin-top: 8px;
        padding-top: 14px;
      }

      .paid {
        color: var(--accent);
        font-weight: 700;
      }

      .pending {
        color: #92400e;
        font-weight: 700;
      }

      .footer {
        padding: 24px 36px;
        font-size: 12px;
        line-height: 1.6;
        text-align: center;
      }

      @media (max-width: 640px) {
        .header,
        .customer,
        .grid {
          grid-template-columns: 1fr;
        }

        .header {
          display: grid;
          padding: 24px;
        }

        .total {
          text-align: left;
        }

        .section,
        .footer {
          padding-left: 24px;
          padding-right: 24px;
        }
      }

      @media print {
        body {
          background: #ffffff;
        }

        .page {
          margin: 0;
          max-width: none;
          padding: 0;
        }

        .receipt {
          border: 0;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <article class="receipt">
        <header class="header">
          <div>
            <h1 class="brand">${escapeHtml(businessName)}</h1>
            <p class="subtitle">Official order receipt</p>
          </div>
          <div class="total">
            <span>Total</span>
            <strong>${formatMoney(order.total)}</strong>
          </div>
        </header>

        <section class="section grid">
          <div class="field">
            <span>Receipt no.</span>
            <strong>${escapeHtml(receiptNumber)}</strong>
          </div>
          <div class="field">
            <span>Placed</span>
            <strong>${escapeHtml(formatDate(order.createdAt))}</strong>
          </div>
          <div class="field">
            <span>Payment</span>
            <strong>${escapeHtml(getPaymentLabel(order))}</strong>
          </div>
          <div class="field">
            <span>Status</span>
            <strong class="${order.status === "paid" ? "paid" : "pending"}">${escapeHtml(
              getStatusLabel(order),
            )}</strong>
          </div>
        </section>

        <section class="section customer">
          <p>
            <span>Customer</span>
            ${escapeHtml(order.customer.name)}<br />
            ${escapeHtml(order.customer.email)}<br />
            ${escapeHtml(order.customer.phone)}
          </p>
          <p>
            <span>Fulfillment</span>
            ${escapeHtml(getFulfillmentLabel(order))}
          </p>
          ${deliveryAddress}
        </section>

        <section class="section">
          <table aria-label="Order items">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>

        <section class="section">
          <div class="summary">
            <div>
              <span>Subtotal</span>
              <strong>${formatMoney(subtotal)}</strong>
            </div>
            <div>
              <span>Delivery fee</span>
              <strong>${formatMoney(order.deliveryFee)}</strong>
            </div>
            <div>
              <span>Tip</span>
              <strong>${formatMoney(order.tip)}</strong>
            </div>
            <div class="grand">
              <span>${escapeHtml(getTotalLabel(order))}</span>
              <strong>${formatMoney(order.total)}</strong>
            </div>
          </div>
        </section>

        <footer class="footer">
          Order ID: ${escapeHtml(order.id)}<br />
          Thanks for ordering with ${escapeHtml(businessName)}. For receipt questions, contact ${escapeHtml(supportEmail)}.
        </footer>
      </article>
    </main>
  </body>
</html>`;
};

const addText = (
  commands: string[],
  value: string | number,
  x: number,
  y: number,
  size: number,
  font: "F1" | "F2" = "F1",
  color = "0.07 0.09 0.13",
) => {
  commands.push(
    `BT /${font} ${size} Tf ${color} rg ${x} ${y} Td (${escapePdfText(
      value,
    )}) Tj ET`,
  );
};

const approximateTextWidth = (value: string | number, size: number) =>
  normalizePdfText(value).length * size * 0.5;

const addRightText = (
  commands: string[],
  value: string | number,
  right: number,
  y: number,
  size: number,
  font: "F1" | "F2" = "F1",
  color = "0.07 0.09 0.13",
) => {
  addText(
    commands,
    value,
    Math.max(48, right - approximateTextWidth(value, size)),
    y,
    size,
    font,
    color,
  );
};

const addLine = (commands: string[], y: number) => {
  commands.push(`0.86 0.88 0.91 RG 48 ${y} m 564 ${y} l S`);
};

const addLabelValue = (
  commands: string[],
  label: string,
  value: string,
  x: number,
  y: number,
) => {
  addText(commands, label.toUpperCase(), x, y, 8, "F2", "0.42 0.45 0.5");
  addText(commands, value, x, y - 14, 10, "F1");
};

const buildPdfDocument = (content: string) => {
  const stream = `${content}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [5 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`,
    `<< /Length ${Buffer.byteLength(
      stream,
      "latin1",
    )} >>\nstream\n${stream}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
};

export const buildReceiptPdf = (order: OrderRecord) => {
  const receiptNumber = getReceiptNumber(order);
  const lineItems = getLineItems(order);
  const subtotal = getSubtotal(order);
  const commands: string[] = [];

  commands.push("0.98 0.99 1 rg 0 0 612 792 re f");
  commands.push("1 1 1 rg 36 36 540 720 re f");
  commands.push("0.88 0.9 0.94 RG 36 36 540 720 re S");
  commands.push("0.02 0.48 0.35 rg 36 736 540 20 re f");

  addText(commands, businessName, 56, 704, 24, "F2");
  addText(commands, "Official order receipt", 56, 684, 10, "F1", "0.42 0.45 0.5");
  addRightText(commands, "Total", 552, 704, 10, "F2", "0.42 0.45 0.5");
  addRightText(commands, formatMoney(order.total), 552, 680, 24, "F2");
  addLine(commands, 662);

  addLabelValue(commands, "Receipt no.", receiptNumber, 56, 636);
  addLabelValue(commands, "Placed", formatDate(order.createdAt), 220, 636);
  addLabelValue(commands, "Payment", getPaymentLabel(order), 392, 636);
  addLabelValue(commands, "Status", getStatusLabel(order), 56, 594);
  addLabelValue(commands, "Fulfillment", getFulfillmentLabel(order), 220, 594);
  addText(commands, "ORDER ID", 392, 594, 8, "F2", "0.42 0.45 0.5");
  addText(commands, order.id, 392, 580, 7, "F1");

  addLine(commands, 560);
  addText(commands, "Customer", 56, 534, 12, "F2");
  addText(commands, order.customer.name, 56, 516, 10);
  addText(commands, order.customer.email, 56, 502, 10, "F1", "0.42 0.45 0.5");
  addText(commands, order.customer.phone, 56, 488, 10, "F1", "0.42 0.45 0.5");

  if (order.fulfillment === "delivery" && order.customer.address.trim()) {
    addText(commands, "Delivery address", 340, 534, 12, "F2");
    wrapText(order.customer.address, 34).forEach((line, index) => {
      addText(commands, line, 340, 516 - index * 14, 10);
    });
  }

  addLine(commands, 464);
  addText(commands, "Item", 56, 440, 9, "F2", "0.42 0.45 0.5");
  addRightText(commands, "Qty", 364, 440, 9, "F2", "0.42 0.45 0.5");
  addRightText(commands, "Unit", 456, 440, 9, "F2", "0.42 0.45 0.5");
  addRightText(commands, "Amount", 552, 440, 9, "F2", "0.42 0.45 0.5");
  addLine(commands, 430);

  let y = 408;
  lineItems.forEach((item) => {
    const nameLines = wrapText(item.name, 42);
    nameLines.forEach((line, index) => {
      addText(commands, line, 56, y - index * 13, 10, index === 0 ? "F2" : "F1");
    });
    addRightText(commands, item.quantity, 364, y, 10);
    addRightText(commands, formatMoney(item.unitPrice), 456, y, 10);
    addRightText(commands, formatMoney(item.lineTotal), 552, y, 10, "F2");
    y -= Math.max(24, nameLines.length * 13 + 10);
  });

  addLine(commands, y + 8);
  y -= 18;
  addRightText(commands, "Subtotal", 456, y, 10, "F1", "0.42 0.45 0.5");
  addRightText(commands, formatMoney(subtotal), 552, y, 10);
  y -= 18;
  addRightText(commands, "Delivery fee", 456, y, 10, "F1", "0.42 0.45 0.5");
  addRightText(commands, formatMoney(order.deliveryFee), 552, y, 10);
  y -= 18;
  addRightText(commands, "Tip", 456, y, 10, "F1", "0.42 0.45 0.5");
  addRightText(commands, formatMoney(order.tip), 552, y, 10);
  y -= 24;
  commands.push(`0.07 0.09 0.13 RG 380 ${y + 14} m 552 ${y + 14} l S`);
  addRightText(commands, getTotalLabel(order), 456, y, 12, "F2");
  addRightText(commands, formatMoney(order.total), 552, y, 12, "F2");

  addText(
    commands,
    `Order ID: ${order.id}`,
    56,
    84,
    8,
    "F1",
    "0.42 0.45 0.5",
  );
  addText(
    commands,
    `Thanks for ordering with ${businessName}. Questions: ${supportEmail}`,
    56,
    68,
    9,
    "F1",
    "0.42 0.45 0.5",
  );

  return buildPdfDocument(commands.join("\n"));
};
