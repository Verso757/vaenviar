import Link from "next/link";
import { getPrisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GuardPickupListPage() {
  const user = await requireUser();
  if (user.role !== "GUARD") return null;
  if (!user.locationId) {
    return (
      <main className="app-shell">
        <section className="app-card">
          <h1 className="page-title">Entregar a chofer</h1>
          <p className="page-subtitle">Tu usuario no tiene ubicación asignada.</p>
        </section>
      </main>
    );
  }

  const prisma = getPrisma();
  const shipments = await prisma.shipment.findMany({
    where: {
      fromLocationId: user.locationId,
      status: "WAITING_PICKUP",
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      code: true,
      createdAt: true,
      toLocation: { select: { code: true, name: true } },
      recipient: { select: { name: true, email: true } },
      packages: { select: { id: true } },
    },
  });

  return (
    <main className="app-shell">
      <h1 className="page-title">Entregar a chofer</h1>
      <p className="page-subtitle">Pendientes por entregar (origen = tu ubicación).</p>

      <div className="mt-6 space-y-3">
        {shipments.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No hay envíos pendientes.
          </p>
        ) : (
          shipments.map((s) => (
            <Link key={s.id} href={`/guard/pickup/${s.id}`} className="list-card">
              <div className="flex items-center justify-between">
                <div className="font-medium">{s.code}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {new Date(s.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                Destino: {s.toLocation.code} — {s.toLocation.name}
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
