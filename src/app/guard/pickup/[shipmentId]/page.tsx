import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sendShipmentMilestoneEmail } from "@/lib/email";

type PageProps = {
  params: { shipmentId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function GuardPickupShipmentPage(props: PageProps) {
  const user = await requireUser();
  if (user.role !== "GUARD") redirect("/");
  if (!user.locationId) redirect("/guard/pickup");

  const error = typeof props.searchParams?.error === "string" ? props.searchParams.error : null;

  const shipment = await prisma.shipment.findUnique({
    where: { id: props.params.shipmentId },
    include: {
      packages: { orderBy: { sequence: "asc" } },
      toLocation: true,
      fromLocation: true,
      recipient: { select: { name: true, email: true } },
    },
  });

  if (!shipment) notFound();
  if (shipment.fromLocationId !== user.locationId) redirect("/guard/pickup");
  if (shipment.status !== "WAITING_PICKUP") redirect("/guard/pickup");

  async function handoverAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (currentUser.role !== "GUARD") redirect("/");
    if (!currentUser.locationId) redirect("/guard/pickup");

    const shipmentId = String(formData.get("shipmentId") ?? "");
    const driverName = String(formData.get("driverName") ?? "").trim();
    const checkedPackageIds = formData.getAll("packageId").map((v) => String(v));

    if (!shipmentId || !driverName) redirect(`/guard/pickup/${shipmentId}?error=missing`);

    await prisma.$transaction(async (tx) => {
      const dbShipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: { packages: true },
      });
      if (!dbShipment) throw new Error("Shipment not found");
      if (dbShipment.fromLocationId !== currentUser.locationId) throw new Error("Wrong location");
      if (dbShipment.status !== "WAITING_PICKUP") throw new Error("Wrong status");

      const packagesSet = new Set(dbShipment.packages.map((p) => p.id));
      const filteredChecked = checkedPackageIds.filter((id) => packagesSet.has(id));

      const existingDriver = await tx.driver.findFirst({
        where: { name: driverName },
        select: { id: true },
      });

      const driverId = existingDriver?.id ?? (
        await tx.driver.create({
          data: { name: driverName, createdById: currentUser.id },
          select: { id: true },
        })
      ).id;

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          type: "HANDED_TO_DRIVER",
          locationId: currentUser.locationId,
          userId: currentUser.id,
          driverId,
          driverName,
          payload: {
            checkedPackageIds: filteredChecked,
          },
        },
      });

      await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: "IN_TRANSIT" },
      });
    });

    await sendShipmentMilestoneEmail({
      shipmentId,
      event: "HANDED_TO_DRIVER",
      extra: { driverName },
    });

    redirect("/guard/pickup");
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Entrega a chofer</h1>
      <p className="mt-2 text-sm text-gray-600">{shipment.code}</p>

      {error ? (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error === "missing" ? "Falta nombre del chofer." : "Error"}
        </p>
      ) : null}

      <div className="mt-6 rounded border p-4">
        <div className="text-sm text-gray-700">
          Destino: {shipment.toLocation.code} — {shipment.toLocation.name}
        </div>
        <div className="mt-1 text-sm text-gray-700">
          Destinatario: {shipment.recipient.name} ({shipment.recipient.email})
        </div>
      </div>

      <form action={handoverAction} className="mt-6 space-y-4">
        <input type="hidden" name="shipmentId" value={shipment.id} />

        <label className="block">
          <span className="text-sm">Chofer (nombre)</span>
          <input name="driverName" className="mt-1 w-full rounded border px-3 py-2" required />
        </label>

        <div className="rounded border p-4">
          <p className="text-sm font-medium">Checklist cajas entregadas</p>
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
          Confirmar entrega a chofer
        </button>
      </form>
    </main>
  );
}
