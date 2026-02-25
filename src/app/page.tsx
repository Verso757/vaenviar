import Link from "next/link";
import { logoutCurrentSession, requireUser } from "@/lib/auth";

export default async function Home() {
  const user = await requireUser();

  async function logoutAction() {
    "use server";
    await logoutCurrentSession();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">VaEnviar</h1>
        <form action={logoutAction}>
          <button className="rounded border px-3 py-2 text-sm" type="submit">
            Salir
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm text-gray-700">
        Sesión: <span className="font-medium">{user.name}</span> ({user.email})
      </p>
      <p className="mt-1 text-sm text-gray-700">Rol: {user.role}</p>

      <div className="mt-8 rounded border p-4">
        <p className="text-sm font-medium">Siguientes pasos</p>
        <ul className="mt-2 list-inside list-disc text-sm text-gray-700">
          <li>Crear envío</li>
          <li>Vista de pendientes para vigilancia</li>
          <li>Handover a chofer con checklist</li>
          <li>Entrega final con firma</li>
        </ul>
      </div>

      <div className="mt-6 flex gap-3">
        {user.role !== "GUARD" ? (
          <Link href="/shipments/new" className="rounded bg-black px-3 py-2 text-sm text-white">
            Crear envío
          </Link>
        ) : null}

        {user.role === "GUARD" ? (
          <>
            <Link href="/guard/pickup" className="rounded border px-3 py-2 text-sm">
              Entregar a chofer
            </Link>
            <Link href="/guard/receive" className="rounded border px-3 py-2 text-sm">
              Recibir
            </Link>
            <Link href="/guard/deliver" className="rounded border px-3 py-2 text-sm">
              Entregar (firma)
            </Link>
          </>
        ) : null}
      </div>

      <p className="mt-6 text-sm">
        Ir a{" "}
        <Link href="/login" className="underline">
          Login
        </Link>
        .
      </p>
    </main>
  );
}
