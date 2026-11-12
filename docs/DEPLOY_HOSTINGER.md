# Deploying Lumina PMS on Hostinger (Node.js web app + MySQL)

Requires a Hostinger plan with **Node.js web apps** (Business/Cloud or VPS) and a **MySQL database**.

## 1. Create the database
hPanel > Databases > MySQL Databases: create a database, user and password. Note the **database name, username, password and host** (usually `localhost` when the app runs on the same Hostinger account, otherwise the remote host shown there).

`DATABASE_URL=mysql://DB_USER:DB_PASSWORD@DB_HOST:3306/DB_NAME`
URL-encode special characters in the password (`@` -> `%40`, `#` -> `%23`, `/` -> `%2F`).

## 2. Create the Node.js app
hPanel > Websites > Add website > Node.js Apps. Import the Git repository (or upload a zip). Settings:

| Setting | Value |
|---|---|
| Node version | 20 or newer |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Start command | `npm run start:prod` |

`start` and `start:prod` both apply pending database migrations (`prisma migrate deploy`) and then start the app, so the tables are created on first start.

## 3. Environment variables
Set these in the app's Environment Variables panel **before building** (`NEXT_PUBLIC_*` values are baked in at build time). Generate your own secrets; never reuse examples.

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | see step 1 |
| `AUTH_SECRET` | `openssl rand -base64 48` |
| `AUTH_ENCRYPTION_KEY` | `openssl rand -hex 32` (back it up!) |
| `INTEGRATION_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `INTEGRATION_WEBHOOK_SECRET` | `openssl rand -hex 32` |
| `AUTH_URL` | `https://your-domain.com` |
| `AUTH_TRUST_HOST` | `true` |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_DEFAULT_TIMEZONE`, `NEXT_PUBLIC_CHATBOT_ENABLED` | your values |
| `EMAIL_PROVIDER` | `smtp` (or `resend`, or `log` to only log emails) |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | your Hostinger mailbox |
| `PAYMENT_WEBHOOK_SECRET` | only if using the payment webhook |

The app refuses to start in production if `AUTH_SECRET` is a default value, either encryption key is the zero key or not 64 hex characters, or `DATABASE_URL` is not `mysql://`.

Do not set `PORT`/`HOSTNAME` unless Hostinger asks you to; the platform provides them.

## 4. First login
Register at `/register` to create your organization (first user becomes admin). Optional demo data: set `ALLOW_PRODUCTION_SEED=true` and `SEED_ADMIN_PASSWORD=<strong password>` and run `npm run db:seed` once from the Hostinger terminal, then remove both variables. **The seed wipes existing data** - never run it on a live database.

## 5. AI providers
AI keys are entered in the app (AI > Providers) and stored encrypted; they are not environment variables.

## Troubleshooting
- *Application fails at boot with "Invalid environment configuration"*: a variable above is missing or still a placeholder.
- *Prisma cannot connect*: check host (`localhost` vs remote), enable Remote MySQL in hPanel if the app runs elsewhere, check password encoding.
- *`CREATE`/`ALTER` denied during migrate*: the database user needs ALL privileges on that database.
- *Blank styles/images*: ensure the build ran `npm run build` (it copies static assets into the standalone output).
