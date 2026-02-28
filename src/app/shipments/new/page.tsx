import crypto from "crypto";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
import { sendShipmentMilestoneEmail } from "@/lib/email";

function generateShipmentCode() {
  return `ENV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function NewShipmentPage(props: PageProps) {
  const user = await requireUser();

  const prisma = getPrisma();

  if (user.role === "GUARD") {
    redirect("/");
  }

  const locations = await prisma.location.findMany({
    orderBy: [{ name: "asc" }],
    select: { id: true, code: true, name: true },
  });

  const error = typeof props.searchParams?.error === "string" ? props.searchParams.error : null;

  async function createShipmentAction(formData: FormData): Promise<void> {
    "use server";

    const currentUser = await requireUser();
    if (currentUser.role === "GUARD") redirect("/");

    const prisma = getPrisma();

    const fromLocationId = String(formData.get("fromLocationId") ?? "").trim();
    const toLocationId = String(formData.get("toLocationId") ?? "").trim();
    const recipientEmail = String(formData.get("recipientEmail") ?? "")
      .trim()
      .toLowerCase();
    const description = String(formData.get("description") ?? "").trim();
    const packagesCountRaw = String(formData.get("packagesCount") ?? "1").trim();
    const packagesCount = Math.max(1, Math.min(50, Number.parseInt(packagesCountRaw, 10) || 1));

    if (!fromLocationId || !toLocationId || !recipientEmail) {
      redirect("/shipments/new?error=missing");
    }

    if (fromLocationId === toLocationId) {
      redirect("/shipments/new?error=same_location");
    }

    const recipient = await prisma.user.findUnique({ where: { email: recipientEmail } });
    if (!recipient) {
      redirect("/shipments/new?error=recipient_not_found");
    }

    const code = generateShipmentCode();

    let created;
    try {
      created = await prisma.shipment.create({
        data: {
          code,
          status: "WAITING_PICKUP",
          description: description || null,
          fromLocationId,
          toLocationId,
          createdById: currentUser.id,
          recipientId: recipient.id,
          packages: {
            create: Array.from({ length: packagesCount }, (_, idx) => ({
              sequence: idx + 1,
              label: `Caja ${idx + 1}`,
            })),
          },
          events: {
            create: {
              type: "CREATED",
              locationId: fromLocationId,
              userId: currentUser.id,
              payload: {
                packagesCount,
              },
            },
          },
        },
        select: { id: true },
      });
    } catch (e) {
      console.error("[shipments/new] Failed to create shipment", e);
      redirect("/shipments/new?error=server");
    }

    try {
      await sendShipmentMilestoneEmail({
        shipmentId: created.id,
        event: "CREATED",
      });
    } catch (e) {
      console.error("[shipments/new] Failed to send CREATED email", e);
    }

    redirect(`/shipments/${created.id}/label`);
  }

  const defaultFromLocationId = user.locationId ?? "";

  return (
    <main className="app-shell max-w-3xl">
      <section className="app-card">
        <h1 className="page-title">Crear envío</h1>
        <p className="page-subtitle">Genera el envío y luego imprime la etiqueta con QR.</p>

        {error ? (
          <p className="alert-error mt-4">
            {error === "missing" ? "Faltan campos." : null}
            {error === "same_location" ? "Origen y destino no pueden ser el mismo." : null}
            {error === "recipient_not_found" ? "No existe el destinatario (correo)." : null}
            {error === "server" ? "Error del servidor al crear el envío. Revisa logs y vuelve a intentar." : null}
          </p>
        ) : null}

        <form action={createShipmentAction} className="mt-6 space-y-4">
          <label className="block">
            <span className="field-label">Origen (ubicación)</span>
            <select
              name="fromLocationId"
              className="input-base"
              defaultValue={defaultFromLocationId}
              required
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} — {loc.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label">Destino (ubicación)</span>
            <select name="toLocationId" className="input-base" defaultValue="" required>
              <option value="" disabled>
                Selecciona...
              </option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} — {loc.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label">Destinatario (correo)</span>
            <input
              name="recipientEmail"
              type="email"
              className="input-base"
              placeholder="usuario@empresa.com"
              required
            />
          </label>

          <label className="block">
            <span className="field-label">Número de cajas</span>
            <input
              name="packagesCount"
              type="number"
              min={1}
              max={50}
              defaultValue={1}
              className="input-base"
              required
            />
          </label>

          <label className="block">
            <span className="field-label">Descripción (opcional)</span>
            <textarea name="description" className="input-base" rows={3} />
          </label>

          <button className="btn-primary w-full" type="submit">
            Crear e imprimir etiqueta
          </button>
        </form>
      </section>
    </main>
  );
}
