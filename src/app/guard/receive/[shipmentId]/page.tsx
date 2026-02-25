import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sendShipmentMilestoneEmail } from "@/lib/email";

type PageProps = {
  params: { shipmentId: string };
};

export default async function GuardReceiveShipmentPage(props: PageProps) {
  const user = await requireUser();
  if (user.role !== "GUARD") redirect("/");
  if (!user.locationId) redirect("/guard/receive");

  const shipment = await prisma.shipment.findUnique({
    where: { id: props.params.shipmentId },
    include: {
      packages: { orderBy: { sequence: "asc" } },
      fromLocation: true,
      toLocation: true,
      recipient: { select: { name: true, email: true } },
    },
  });

  if (!shipment) notFound();
  if (shipment.toLocationId !== user.locationId) redirect("/guard/receive");
  if (shipment.status !== "IN_TRANSIT") redirect("/guard/receive");

  async function receiveAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (currentUser.role !== "GUARD") redirect("/");
    if (!currentUser.locationId) redirect("/guard/receive");

    const shipmentId = String(formData.get("shipmentId") ?? "");
    const checkedPackageIds = formData.getAll("packageId").map((v) => String(v));

    await prisma.$transaction(async (tx) => {
      const dbShipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: { packages: true },
      });
      if (!dbShipment) throw new Error("Shipment not found");
      if (dbShipment.toLocationId !== currentUser.locationId) throw new Error("Wrong location");
      if (dbShipment.status !== "IN_TRANSIT") throw new Error("Wrong status");

      const packagesSet = new Set(dbShipment.packages.map((p) => p.id));
      const filteredChecked = checkedPackageIds.filter((id) => packagesSet.has(id));

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          type: "RECEIVED_AT_DESTINATION",
          locationId: currentUser.locationId,
          userId: currentUser.id,
          payload: {
            checkedPackageIds: filteredChecked,
          },
        },
      });

      await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: "RECEIVED_AT_DESTINATION" },
      });
    });

    await sendShipmentMilestoneEmail({
      shipmentId,
      event: "RECEIVED_AT_DESTINATION",
    });

    redirect("/guard/receive");
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Recibo en destino</h1>
      <p className="mt-2 text-sm text-gray-600">{shipment.code}</p>

      <div className="mt-6 rounded border p-4">
        <div className="text-sm text-gray-700">
          Origen: {shipment.fromLocation.code} — {shipment.fromLocation.name}
        </div>
        <div className="mt-1 text-sm text-gray-700">
          Destinatario: {shipment.recipient.name} ({shipment.recipient.email})
        </div>
      </div>

      <form action={receiveAction} className="mt-6 space-y-4">
        <input type="hidden" name="shipmentId" value={shipment.id} />

        <div className="rounded border p-4">
          <p className="text-sm font-medium">Checklist cajas recibidas</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {shipment.packages.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input type="checkbox" name="packageId" value={p.id} defaultChecked />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        <button className="w-full rounded bg-black px-3 py-2 text-white" type="submit">
          Confirmar recibido
        </button>
      </form>
    </main>
  );
}
