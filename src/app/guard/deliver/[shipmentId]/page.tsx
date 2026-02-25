import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SignaturePad } from "../SignaturePad";
import { sendShipmentMilestoneEmail } from "@/lib/email";

type PageProps = {
  params: { shipmentId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function GuardDeliverShipmentPage(props: PageProps) {
  const user = await requireUser();
  if (user.role !== "GUARD") redirect("/");
  if (!user.locationId) redirect("/guard/deliver");

  const error = typeof props.searchParams?.error === "string" ? props.searchParams.error : null;

  const shipment = await prisma.shipment.findUnique({
    where: { id: props.params.shipmentId },
    include: {
      packages: { orderBy: { sequence: "asc" } },
      toLocation: true,
      recipient: { select: { id: true, name: true, email: true } },
    },
  });

  if (!shipment) notFound();
  if (shipment.toLocationId !== user.locationId) redirect("/guard/deliver");
  if (shipment.status !== "RECEIVED_AT_DESTINATION") redirect("/guard/deliver");

  async function deliverAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (currentUser.role !== "GUARD") redirect("/");
    if (!currentUser.locationId) redirect("/guard/deliver");

    const shipmentId = String(formData.get("shipmentId") ?? "");
    const signedByName = String(formData.get("signedByName") ?? "").trim();
    const signatureData = String(formData.get("signatureData") ?? "");

    if (!shipmentId || !signedByName) redirect(`/guard/deliver/${shipmentId}?error=missing`);
    if (!signatureData || signatureData.length < 50) redirect(`/guard/deliver/${shipmentId}?error=signature`);

    await prisma.$transaction(async (tx) => {
      const dbShipment = await tx.shipment.findUnique({ where: { id: shipmentId } });
      if (!dbShipment) throw new Error("Shipment not found");
      if (dbShipment.toLocationId !== currentUser.locationId) throw new Error("Wrong location");
      if (dbShipment.status !== "RECEIVED_AT_DESTINATION") throw new Error("Wrong status");

      const event = await tx.shipmentEvent.create({
        data: {
          shipmentId,
          type: "DELIVERED",
          locationId: currentUser.locationId,
          userId: currentUser.id,
          payload: {},
        },
        select: { id: true },
      });

      await tx.deliverySignature.create({
        data: {
          shipmentId,
          eventId: event.id,
          signedByName,
          signedById: null,
          signatureData,
        },
      });

      await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: "DELIVERED" },
      });
    });

    await sendShipmentMilestoneEmail({
      shipmentId,
      event: "DELIVERED",
      extra: { signedByName },
    });

    redirect("/guard/deliver");
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Entrega final</h1>
      <p className="mt-2 text-sm text-gray-600">{shipment.code}</p>

      {error ? (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error === "missing" ? "Falta nombre del receptor." : null}
          {error === "signature" ? "Falta firma." : null}
        </p>
      ) : null}

      <div className="mt-6 rounded border p-4">
        <div className="text-sm text-gray-700">Destino: {shipment.toLocation.code} — {shipment.toLocation.name}</div>
        <div className="mt-1 text-sm text-gray-700">
          Destinatario: {shipment.recipient.name} ({shipment.recipient.email})
        </div>
        <div className="mt-1 text-sm text-gray-700">Cajas: {shipment.packages.length}</div>
      </div>

      <form action={deliverAction} className="mt-6 space-y-4">
        <input type="hidden" name="shipmentId" value={shipment.id} />

        <label className="block">
          <span className="text-sm">Nombre de quien recibe</span>
          <input name="signedByName" className="mt-1 w-full rounded border px-3 py-2" required />
        </label>

        <SignaturePad />

        <button className="w-full rounded bg-black px-3 py-2 text-white" type="submit">
          Confirmar entrega y guardar firma
        </button>
      </form>
    </main>
  );
}
