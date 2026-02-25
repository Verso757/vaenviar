import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

type ShipmentMailEvent =
  | "CREATED"
  | "HANDED_TO_DRIVER"
  | "RECEIVED_AT_DESTINATION"
  | "DELIVERED";

function isEmailEnabled() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendShipmentMilestoneEmail(args: {
  shipmentId: string;
  event: ShipmentMailEvent;
  extra?: { driverName?: string; signedByName?: string };
}) {
  if (!isEmailEnabled()) return;

  const transport = getTransport();
  if (!transport) return;

  const shipment = await prisma.shipment.findUnique({
    where: { id: args.shipmentId },
    include: {
      fromLocation: true,
      toLocation: true,
      recipient: { select: { email: true, name: true } },
      createdBy: { select: { email: true, name: true } },
      packages: true,
    },
  });

  if (!shipment) return;

  const fromGuards = await prisma.user.findMany({
    where: { role: "GUARD", locationId: shipment.fromLocationId },
    select: { email: true },
  });

  const toGuards = await prisma.user.findMany({
    where: { role: "GUARD", locationId: shipment.toLocationId },
    select: { email: true },
  });

  const to = new Set<string>();
  to.add(shipment.recipient.email);
  to.add(shipment.createdBy.email);
  for (const g of fromGuards) to.add(g.email);
  for (const g of toGuards) to.add(g.email);

  const subjectMap: Record<ShipmentMailEvent, string> = {
    CREATED: `Nuevo envío ${shipment.code}`,
    HANDED_TO_DRIVER: `Envío ${shipment.code} entregado a chofer`,
    RECEIVED_AT_DESTINATION: `Envío ${shipment.code} recibido en destino`,
    DELIVERED: `Envío ${shipment.code} entregado`,
  };

  const lines: string[] = [];
  lines.push(`Evento: ${args.event}`);
  lines.push(`Código: ${shipment.code}`);
  lines.push(`Origen: ${shipment.fromLocation.code} — ${shipment.fromLocation.name}`);
  lines.push(`Destino: ${shipment.toLocation.code} — ${shipment.toLocation.name}`);
  lines.push(`Cajas: ${shipment.packages.length}`);
  if (args.extra?.driverName) lines.push(`Chofer: ${args.extra.driverName}`);
  if (args.extra?.signedByName) lines.push(`Recibió: ${args.extra.signedByName}`);

  if (shipment.description) {
    lines.push("");
    lines.push(`Descripción: ${shipment.description}`);
  }

  const from = process.env.SMTP_FROM!;

  await transport.sendMail({
    from,
    to: Array.from(to).join(","),
    subject: subjectMap[args.event],
    text: lines.join("\n"),
  });
}
