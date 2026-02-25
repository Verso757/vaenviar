import Image from "next/image";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PrintButton } from "./PrintButton";

type PageProps = {
  params: { shipmentId: string };
};

export default async function ShipmentLabelPage(props: PageProps) {
  await requireUser();
  const { shipmentId } = props.params;

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      fromLocation: true,
      toLocation: true,
      packages: { orderBy: { sequence: "asc" } },
      recipient: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!shipment) notFound();

  const qrText = `VAENVIAR:${shipment.code}`;
  const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 256 });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Etiqueta</h1>
        <PrintButton />
      </div>

      <div className="mt-6 rounded border p-6 print:border-0 print:p-0">
        <div className="flex items-start gap-6">
          <div className="shrink-0">
            <Image src={qrDataUrl} alt="QR" width={256} height={256} />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-600">Código</p>
            <p className="text-2xl font-semibold tracking-wide">{shipment.code}</p>

            <div className="mt-4 grid gap-2 text-sm">
              <div>
                <span className="text-gray-600">Origen:</span> {shipment.fromLocation.code} — {shipment.fromLocation.name}
              </div>
              <div>
                <span className="text-gray-600">Destino:</span> {shipment.toLocation.code} — {shipment.toLocation.name}
              </div>
              <div>
                <span className="text-gray-600">Destinatario:</span> {shipment.recipient.name} ({shipment.recipient.email})
              </div>
              <div>
                <span className="text-gray-600">Creado por:</span> {shipment.createdBy.name} ({shipment.createdBy.email})
              </div>
              <div>
                <span className="text-gray-600">Cajas:</span> {shipment.packages.length}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium">Checklist (para vigilancia/chofer)</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {shipment.packages.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 rounded border" />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        {shipment.description ? (
          <div className="mt-6 text-sm">
            <p className="font-medium">Descripción</p>
            <p className="text-gray-700">{shipment.description}</p>
          </div>
        ) : null}
      </div>

      <style>{`@media print { button { display: none; } }`}</style>
    </main>
  );
}
