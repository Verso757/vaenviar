import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionForUser, getCurrentUser } from "@/lib/auth";

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

    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) redirect("/login?error=missing");

    const dbUser = await prisma.user.findUnique({ where: { email } });
    if (!dbUser) redirect("/login?error=invalid");

    const ok = await bcrypt.compare(password, dbUser.passwordHash);
    if (!ok) redirect("/login?error=invalid");

    await createSessionForUser(dbUser.id);
    redirect("/");
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">VaEnviar</h1>
      <p className="mt-2 text-sm text-gray-600">Inicia sesión para continuar.</p>

      {error ? (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error === "missing" ? "Faltan campos." : "Correo o contraseña inválidos."}
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
