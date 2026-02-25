# VaEnviar

Webapp interna para gestionar envíos dentro de la empresa con trazabilidad por hitos y evidencia (etiqueta + checks + firma), y notificaciones por correo.

## Flujo (MVP)

1) **Empleado crea envío**
- Define destino (usuario final), origen/destino (ubicaciones), y número de cajas.
- Se genera un **código de envío** y una **etiqueta imprimible con QR** para pegar al paquete.

2) **Vigilancia entrega a transportista (externo)**
- El guardia selecciona un chofer (o captura nombre “otro”).
- Marca checklist de cajas entregadas.

3) **Recibo en destino y entrega final**
- Guardia del sitio destino confirma lo recibido.
- En entrega final se captura **firma** del receptor.

En cada hito, el sistema enviará correos a los involucrados (destino y guardias) cuando lo implementemos.

## Tech stack

- Next.js (App Router) + TypeScript
- MySQL + Prisma

## Arranque local

1) Instalar dependencias:

```bash
npm install
```

2) Configurar base de datos:

- Edita `.env` y pon tu `DATABASE_URL` de MySQL.

Ejemplo:

```env
DATABASE_URL="mysql://usuario:password@localhost:3306/vaenviar"
```

3) Crear tablas (cuando tengas MySQL listo):

```bash
npx prisma migrate dev --name init
```

4) Crear ubicaciones base (ejemplo):

```bash
npm run location:create -- --code=CEDIS1 --name="CEDIS 1"
npm run location:create -- --code=CEDIS2 --name="CEDIS 2"
```

5) Generar cliente Prisma (si cambias el schema):

```bash
npx prisma generate
```

6) Correr servidor:

```bash
npm run dev
```

## Crear usuarios (auth local)

Después de migrar la DB, puedes crear usuarios así:

```bash
npm run user:create -- --email=admin@empresa.com --name="Admin" --password=TuPassword --role=ADMIN
```

Para asignar ubicación (por código):

```bash
npm run user:create -- --email=guardia@empresa.com --name="Guardia" --password=TuPassword --role=GUARD --locationCode=CEDIS1
```

## Correos (SMTP)

Configura en `.env`:

```env
SMTP_HOST="smtp.tuempresa.com"
SMTP_PORT="587"
SMTP_USER="usuario_smtp"
SMTP_PASS="password_smtp"
SMTP_FROM="VaEnviar <no-reply@tuempresa.com>"
```

## Deploy en Hostinger (App web de Node.js)

Como esta app usa **Server Actions + MySQL (Prisma)**, NO se puede subir como “Sitio web PHP/HTML” (estático). La opción correcta en Hostinger es **App web de Node.js**.

Pasos típicos:

1) En Hostinger crea una **App web de Node.js** y conecta tu repo (GitHub) o sube el código.

2) Configura variables de entorno en Hostinger (panel de la app):

- `DATABASE_URL` (MySQL de Hostinger)
- `SMTP_*` (opcional)

3) Comandos:

- **Install**: `npm install`
- **Build**: `npm run build`
- **Start**: `npm run start`

Nota: ya existe `postinstall` para correr `prisma generate` automáticamente.

4) Migraciones (crear/actualizar tablas en producción):

Ejecuta `npx prisma migrate deploy` en el entorno de la app (si Hostinger te deja correr comandos), o desde tu PC apuntando al `DATABASE_URL` de producción.

5) Datos base:

Con la base ya migrada, crea ubicaciones/usuarios con:

- `npm run location:create -- --code=CEDIS1 --name="CEDIS 1"`
- `npm run user:create -- --email=... --name=... --password=... --role=...`

## Carpetas clave

- `prisma/schema.prisma`: modelos (usuarios, ubicaciones, envíos, eventos, firma)
- `node_modules/@prisma/client`: Prisma Client generado
