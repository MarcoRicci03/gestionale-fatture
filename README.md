This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Primo avvio (creazione del primo amministratore)

Su un database appena migrato la tabella utenti è vuota: nessuno può accedere,
perché la creazione di nuovi utenti richiede già una sessione admin. Prima di
qualunque altra cosa, dopo aver eseguito le migration
(`npx prisma migrate dev` / `npx prisma migrate deploy`), va lanciato lo script
di bootstrap:

```sh
SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD='una-password-di-almeno-12-caratteri' npm run seed
```

Lo script è idempotente: se esiste già un amministratore non fa nulla. La
password impostata è temporanea (l'app lo segnala all'accesso finché non
viene cambiata da `/account`). In produzione, con lo stack Docker:

```sh
docker compose -f docker-compose.prod.yml exec app node prisma/seed.mjs
```

leggendo `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD` da `.env.prod` (vedi
`.env.prod.example`).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
