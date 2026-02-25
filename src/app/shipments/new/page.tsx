import crypto from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sendShipmentMilestoneEmail } from "@/lib/email";

function generateShipmentCode() {
  return `ENV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

type FormState = {
  error?: string;
};

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function NewShipmentPage(props: PageProps) {
  const user = await requireUser();

  if (user.role === "GUARD") {
    redirect("/");
  }

  const locations = await prisma.location.findMany({
    orderBy: [{ name: "asc" }],
    select: { id: true, code: true, name: true },
  });

  const error = typeof props.searchParams?.error === "string" ? props.searchParams.error : null;

  async function createShipmentAction(formData: FormData): Promise<FormState> {
    "use server";

    const currentUser = await requireUser();
    if (currentUser.role === "GUARD") redirect("/");

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

    const created = await prisma.shipment.create({
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

    await sendShipmentMilestoneEmail({
      shipmentId: created.id,
      event: "CREATED",
    });

    redirect(`/shipments/${created.id}/label`);
  }

  const defaultFromLocationId = user.locationId ?? "";

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Crear envío</h1>
      <p className="mt-2 text-sm text-gray-600">Genera el envío y luego imprime la etiqueta con QR.</p>

      {error ? (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error === "missing" ? "Faltan campos." : null}
          {error === "same_location" ? "Origen y destino no pueden ser el mismo." : null}
          {error === "recipient_not_found" ? "No existe el destinatario (correo)." : null}
        </p>
      ) : null}

      <form action={createShipmentAction} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm">Origen (ubicación)</span>
          <select
            name="fromLocationId"
            className="mt-1 w-full rounded border px-3 py-2"
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
          <span className="text-sm">Destino (ubicación)</span>
          <select
            name="toLocationId"
            className="mt-1 w-full rounded border px-3 py-2"
            defaultValue=""
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
          <span className="text-sm">Destinatario (correo)</span>
          <input
            name="recipientEmail"
            type="email"
            className="mt-1 w-full rounded border px-3 py-2"
            placeholder="usuario@empresa.com"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm">Número de cajas</span>
          <input
            name="packagesCount"
            type="number"
            min={1}
            max={50}
            defaultValue={1}
            className="mt-1 w-full rounded border px-3 py-2"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm">Descripción (opcional)</span>
          <textarea name="description" className="mt-1 w-full rounded border px-3 py-2" rows={3} />
        </label>

        <button className="w-full rounded bg-black px-3 py-2 text-white" type="submit">
          Crear e imprimir etiqueta
        </button>
      </form>
    </main>
  );
}
