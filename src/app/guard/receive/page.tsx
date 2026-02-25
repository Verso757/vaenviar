import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export default async function GuardReceiveListPage() {
  const user = await requireUser();
  if (user.role !== "GUARD") return null;
  if (!user.locationId) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Recibir en destino</h1>
        <p className="mt-2 text-sm text-gray-700">Tu usuario no tiene ubicación asignada.</p>
      </main>
    );
  }

  const shipments = await prisma.shipment.findMany({
    where: {
      toLocationId: user.locationId,
      status: "IN_TRANSIT",
    },
    orderBy: [{ updatedAt: "asc" }],
    select: {
      id: true,
      code: true,
      updatedAt: true,
      fromLocation: { select: { code: true, name: true } },
      recipient: { select: { name: true, email: true } },
      packages: { select: { id: true } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Recibir en destino</h1>
      <p className="mt-2 text-sm text-gray-600">En tránsito hacia tu ubicación.</p>

      <div className="mt-6 space-y-3">
        {shipments.length === 0 ? (
          <p className="text-sm text-gray-700">No hay envíos en tránsito.</p>
        ) : (
          shipments.map((s) => (
            <Link
              key={s.id}
              href={`/guard/receive/${s.id}`}
              className="block rounded border p-4 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{s.code}</div>
                <div className="text-xs text-gray-500">{new Date(s.updatedAt).toLocaleString()}</div>
              </div>
              <div className="mt-2 text-sm text-gray-700">
                Origen: {s.fromLocation.code} — {s.fromLocation.name}
              </div>
              <div className="mt-1 text-sm text-gray-700">
                Destinatario: {s.recipient.name} ({s.recipient.email})
              </div>
              <div className="mt-1 text-sm text-gray-700">Cajas: {s.packages.length}</div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
