import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db";
import { createSessionForUser, getCurrentUser } from "@/lib/auth";
import { ensureRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function LoginPage(props: PageProps) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const searchParams = props.searchParams ?? {};
  const error = typeof searchParams.error === "string" ? searchParams.error : null;

  async function loginAction(formData: FormData) {
    "use server";

    const prisma = getPrisma();

    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) redirect("/login?error=missing");

    let dbUser;
    try {
      dbUser = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          locationId: true,
          passwordHash: true,
        },
      });
    } catch (e) {
      console.error("[login] Failed to query user", e);
      redirect("/login?error=server");
    }
    if (!dbUser) redirect("/login?error=invalid");

    ensureRuntimeEnv(["DISABLE_PASSWORD_HASH"]);
    const disablePasswordHash = process.env.DISABLE_PASSWORD_HASH === "true";

    let ok = false;
    try {
      const stored = dbUser.passwordHash;
      const looksLikeBcrypt = typeof stored === "string" && stored.startsWith("$2");
      if (disablePasswordHash || !looksLikeBcrypt) {
        ok = password === stored;
      } else {
        ok = await bcrypt.compare(password, stored);
      }
    } catch (e) {
      console.error("[login] Failed to verify password", e);
      redirect("/login?error=server");
    }
    if (!ok) redirect("/login?error=invalid");

    try {
      await createSessionForUser(dbUser.id);
    } catch (e) {
      console.error("[login] Failed to create session", e);
      redirect("/login?error=server");
    }
    redirect("/");
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">VaEnviar</h1>
      <p className="mt-2 text-sm text-gray-600">Inicia sesión para continuar.</p>

      {error ? (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error === "missing"
            ? "Faltan campos."
            : error === "invalid"
              ? "Correo o contraseña inválidos."
              : "Error del servidor. Revisa conexión a base de datos/variables de entorno y mira los logs."}
        </p>
      ) : null}

      <form action={loginAction} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm">Correo</span>
          <input
            name="email"
            type="email"
            className="mt-1 w-full rounded border px-3 py-2"
            autoComplete="email"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm">Contraseña</span>
          <input
            name="password"
            type="password"
            className="mt-1 w-full rounded border px-3 py-2"
            autoComplete="current-password"
            required
          />
        </label>

        <button className="w-full rounded bg-black px-3 py-2 text-white" type="submit">
          Entrar
        </button>
      </form>

      <p className="mt-6 text-xs text-gray-500">
        Nota: crea usuarios con el script <code className="rounded bg-gray-100 px-1">npm run user:create</code>.
      </p>

      <p className="mt-2 text-xs">
        <Link href="/" className="underline">
          Volver
        </Link>
      </p>
    </main>
  );
}
