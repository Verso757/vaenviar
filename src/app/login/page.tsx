import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db";
import { createSessionForUser, getCurrentUser } from "@/lib/auth";

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

    let dbUser:
      | {
          id: string;
          passwordHash: string;
        }
      | undefined;
    try {
      const rows = (await prisma.$queryRaw`
        SELECT id, passwordHash
        FROM \`User\`
        WHERE email = ${email}
        LIMIT 1
      `) as Array<{ id: string; passwordHash: string }>;
      dbUser = rows[0];
    } catch (e) {
      console.error("[login] Failed to query user", e);
      redirect("/login?error=server");
    }
    if (!dbUser) redirect("/login?error=invalid");

    let ok = false;
    try {
      const stored = dbUser.passwordHash;
      const looksLikeBcrypt = typeof stored === "string" && stored.startsWith("$2");
      if (looksLikeBcrypt) {
        ok = await bcrypt.compare(password, stored);
      } else {
        ok = password === stored;
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
    <main className="app-shell max-w-lg">
      <section className="app-card">
        <h1 className="page-title">VaEnviar</h1>
        <p className="page-subtitle">Inicia sesión para continuar.</p>

        {error ? (
          <p className="alert-error mt-4">
            {error === "missing"
              ? "Faltan campos."
              : error === "invalid"
                ? "Correo o contraseña inválidos."
                : "Error del servidor. Revisa conexión a base de datos/variables de entorno y mira los logs."}
          </p>
        ) : null}

        <form action={loginAction} className="mt-6 space-y-4">
          <label className="block">
            <span className="field-label">Correo</span>
            <input name="email" type="email" className="input-base" autoComplete="email" required />
          </label>

          <label className="block">
            <span className="field-label">Contraseña</span>
            <input
              name="password"
              type="password"
              className="input-base"
              autoComplete="current-password"
              required
            />
          </label>

          <button className="btn-primary w-full" type="submit">
            Entrar
          </button>
        </form>

        <p className="mt-6 text-xs" style={{ color: "var(--muted)" }}>
          Nota: crea usuarios con el script <code className="rounded bg-slate-100 px-1">npm run user:create</code>.
        </p>

        <p className="mt-2 text-xs">
          <Link href="/" className="underline" style={{ color: "var(--primary)" }}>
            Volver
          </Link>
        </p>
      </section>
    </main>
  );
}
