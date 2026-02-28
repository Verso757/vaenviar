import { redirect, notFound } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sendShipmentMilestoneEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { shipmentId: string };
};

export default async function GuardReceiveShipmentPage(props: PageProps) {
  const user = await requireUser();
  if (user.role !== "GUARD") redirect("/");
  if (!user.locationId) redirect("/guard/receive");

  const prisma = getPrisma();

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

    const prisma = getPrisma();

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
    <main className="app-shell">
      <h1 className="page-title">Recibo en destino</h1>
      <p className="page-subtitle">{shipment.code}</p>

      <div className="app-card mt-6">
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          Origen: {shipment.fromLocation.code} — {shipment.fromLocation.name}
        </div>
        <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Destinatario: {shipment.recipient.name} ({shipment.recipient.email})
        </div>
      </div>

      <form action={receiveAction} className="mt-6 space-y-4">
        <input type="hidden" name="shipmentId" value={shipment.id} />

        <div className="app-card">
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

        <button className="btn-primary w-full" type="submit">
          Confirmar recibido
        </button>
      </form>
    </main>
  );
}
