import "server-only";

import nodemailer from "nodemailer";

import type { OrderRecord } from "@/lib/orderStore";
import { buildReceiptPdf, getReceiptFilename } from "@/lib/receipt";

const adminEmail = "dormsideeats@gmail.com";

const parsePrice = (price: string) =>
  Number(price.replace(/[^0-9.]/g, "")) || 0;

const formatMoney = (value: number) => `$${value.toFixed(2)}`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatItemLine = (name: string, quantity: number, price: string) => {
  const unit = parsePrice(price);
  const lineTotal = unit * quantity;
  return `${quantity}× ${name} — ${price} (${formatMoney(lineTotal)})`;
};

const buildTextReceipt = (order: OrderRecord) => {
  const lines = order.items.map((item) =>
    formatItemLine(item.name, item.quantity, item.price),
  );

  return [
    `Dormside order receipt`,
    `Order ID: ${order.id}`,
    `Placed: ${new Date(order.createdAt).toLocaleString()}`,
    "",
    `Customer: ${order.customer.name}`,
    `Email: ${order.customer.email}`,
    `Phone: ${order.customer.phone}`,
    order.fulfillment === "delivery"
      ? `Address: ${order.customer.address}`
      : "Fulfillment: Pickup",
    "",
    "Items:",
    ...lines,
    "",
    `Tip: ${formatMoney(order.tip)}`,
    `Delivery fee: ${formatMoney(order.deliveryFee)}`,
    `Total: ${formatMoney(order.total)}`,
    "",
    `Payment: ${order.paymentMethod === "cash" ? "Cash" : "Card"}`,
    `Status: ${order.status}`,
  ].join("\n");
};

const buildHtmlReceipt = (order: OrderRecord) => {
  const items = order.items
    .map((item) => {
      const unit = parsePrice(item.price);
      const lineTotal = unit * item.quantity;
      return `
        <tr>
          <td style="padding:8px 0;">${item.quantity}× ${escapeHtml(item.name)}</td>
          <td style="padding:8px 0; text-align:right;">${escapeHtml(item.price)}</td>
          <td style="padding:8px 0; text-align:right;">${formatMoney(
            lineTotal,
          )}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a;">
      <h2 style="margin:0 0 8px;">Dormside order receipt</h2>
      <p style="margin:0 0 16px; color:#475569;">
        Order ID: <strong>${order.id}</strong><br/>
        Placed: ${new Date(order.createdAt).toLocaleString()}
      </p>

      <h3 style="margin:16px 0 8px;">Customer</h3>
      <p style="margin:0 0 16px; color:#475569;">
        ${escapeHtml(order.customer.name)}<br/>
        ${escapeHtml(order.customer.email)}<br/>
        ${escapeHtml(order.customer.phone)}<br/>
        ${
          order.fulfillment === "delivery"
            ? escapeHtml(order.customer.address)
            : "Pickup"
        }
      </p>

      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding-bottom:8px; border-bottom:1px solid #e2e8f0;">Item</th>
            <th style="text-align:right; padding-bottom:8px; border-bottom:1px solid #e2e8f0;">Unit</th>
            <th style="text-align:right; padding-bottom:8px; border-bottom:1px solid #e2e8f0;">Line total</th>
          </tr>
        </thead>
        <tbody>
          ${items}
        </tbody>
      </table>

      <table style="width:100%; margin-top:16px;">
        <tr>
          <td style="text-align:right; padding:4px 0; color:#475569;">Tip</td>
          <td style="text-align:right; padding:4px 0;">${formatMoney(
            order.tip,
          )}</td>
        </tr>
        <tr>
          <td style="text-align:right; padding:4px 0; color:#475569;">Delivery fee</td>
          <td style="text-align:right; padding:4px 0;">${formatMoney(
            order.deliveryFee,
          )}</td>
        </tr>
        <tr>
          <td style="text-align:right; padding:8px 0; font-weight:700;">Total</td>
          <td style="text-align:right; padding:8px 0; font-weight:700;">${formatMoney(
            order.total,
          )}</td>
        </tr>
      </table>

      <p style="margin-top:16px; color:#475569;">
        Payment: ${order.paymentMethod === "cash" ? "Cash" : "Card"}<br/>
        Status: ${order.status}
      </p>
    </div>
  `;
};

const getTransporter = () => {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT ?? "0");
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error(
      "Missing email configuration. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS.",
    );
  }

  // Google displays app passwords in groups of four characters, but SMTP expects
  // the uninterrupted value. Other providers retain passwords exactly as entered.
  const smtpPass = /(^|\.)gmail\.com$/i.test(host)
    ? pass.replace(/\s+/g, "")
    : pass;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass: smtpPass,
    },
  });
};

export const sendOrderEmails = async (order: OrderRecord) => {
  const transporter = getTransporter();
  const fromAddress = process.env.EMAIL_USER ?? adminEmail;
  const from = process.env.EMAIL_FROM ?? `Dormside Eats <${fromAddress}>`;
  const customerEmail = order.customer.email?.trim();

  const subject = `Dormside receipt — ${order.customer.name}`;
  const text = buildTextReceipt(order);
  const html = buildHtmlReceipt(order);
  const attachments = [
    {
      filename: getReceiptFilename(order, "pdf"),
      content: buildReceiptPdf(order),
      contentType: "application/pdf",
    },
  ];

  await transporter.verify();

  if (customerEmail && customerEmail.includes("@")) {
    const result = await transporter.sendMail({
      from,
      to: customerEmail,
      bcc: adminEmail,
      replyTo: adminEmail,
      subject,
      text,
      html,
      attachments,
    });
    if (!result.accepted.includes(customerEmail)) {
      throw new Error("The mail provider did not accept the confirmation email.");
    }
    return;
  }

  const result = await transporter.sendMail({
    from,
    to: adminEmail,
    replyTo: order.customer.email,
    subject: `New order received — ${order.customer.name}`,
    text,
    html,
    attachments,
  });
  if (!result.accepted.includes(adminEmail)) {
    throw new Error("The mail provider did not accept the order notification.");
  }
};
