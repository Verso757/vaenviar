import Link from "next/link";
import { logoutCurrentSession, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();

  async function logoutAction() {
    "use server";
    await logoutCurrentSession();
  }

  return (
    <main className="app-shell">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">VaEnviar</h1>
        <form action={logoutAction}>
          <button className="btn-secondary" type="submit">
            Salir
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
        Sesión: <span className="font-medium">{user.name}</span> ({user.email})
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        Rol: {user.role}
      </p>

      <div className="app-card mt-8">
        <p className="text-sm font-medium">Siguientes pasos</p>
        <ul className="mt-2 list-inside list-disc text-sm" style={{ color: "var(--muted)" }}>
          <li>Crear envío</li>
          <li>Vista de pendientes para vigilancia</li>
          <li>Handover a chofer con checklist</li>
          <li>Entrega final con firma</li>
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {user.role !== "GUARD" ? (
          <Link href="/shipments/new" className="btn-primary">
            Crear envío
          </Link>
        ) : null}

        {user.role === "GUARD" ? (
          <>
            <Link href="/guard/pickup" className="btn-secondary">
              Entregar a chofer
            </Link>
            <Link href="/guard/receive" className="btn-secondary">
              Recibir
            </Link>
            <Link href="/guard/deliver" className="btn-secondary">
              Entregar (firma)
            </Link>
          </>
        ) : null}
      </div>

      <p className="mt-6 text-sm">
        Ir a{" "}
        <Link href="/login" className="underline" style={{ color: "var(--primary)" }}>
          Login
        </Link>
        .
      </p>
    </main>
  );
}
