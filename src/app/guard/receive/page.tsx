import Link from "next/link";
import { getPrisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GuardReceiveListPage() {
  const user = await requireUser();
  if (user.role !== "GUARD") return null;
  if (!user.locationId) {
    return (
      <main className="app-shell">
        <section className="app-card">
          <h1 className="page-title">Recibir en destino</h1>
          <p className="page-subtitle">Tu usuario no tiene ubicación asignada.</p>
        </section>
      </main>
    );
  }

  const prisma = getPrisma();
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
    <main className="app-shell">
      <h1 className="page-title">Recibir en destino</h1>
      <p className="page-subtitle">En tránsito hacia tu ubicación.</p>

      <div className="mt-6 space-y-3">
        {shipments.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No hay envíos en tránsito.
          </p>
        ) : (
          shipments.map((s) => (
            <Link key={s.id} href={`/guard/receive/${s.id}`} className="list-card">
              <div className="flex items-center justify-between">
                <div className="font-medium">{s.code}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {new Date(s.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                Origen: {s.fromLocation.code} — {s.fromLocation.name}
              </div>
              <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Destinatario: {s.recipient.name} ({s.recipient.email})
              </div>
              <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Cajas: {s.packages.length}
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
