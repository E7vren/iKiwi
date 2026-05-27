# iKiwi

B2B fresh produce delivery platform connecting iKiwi company with shop owners in Uzbekistan.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: Auth.js v5 (NextAuth)
- **Real-time**: Pusher Channels
- **Email**: Resend
- **Maps**: Mapbox GL JS
- **UI**: Tailwind CSS + shadcn/ui

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 16 (local) or Neon account

### Setup

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp .env.local.example .env.local

# Push schema and seed database
npx prisma db push
npx prisma db seed

# Start dev server
npm run dev
```

Open http://localhost:3000

### Default credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ikiwi.com | admin123 |
| Shop owner | Register at `/register`, then approve in `/admin/shops` |

## Environment Variables

| Variable | Description | Where to get |
|----------|-------------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | Local Postgres or [neon.tech](https://neon.tech) |
| `AUTH_SECRET` | Random 32-byte secret | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App base URL | `http://localhost:3000` in dev |
| `PUSHER_APP_ID` | Pusher app ID | [pusher.com](https://pusher.com) — free Sandbox plan |
| `PUSHER_KEY` | Pusher key | Same app dashboard |
| `PUSHER_SECRET` | Pusher secret | Same app dashboard |
| `PUSHER_CLUSTER` | Pusher cluster (e.g. `ap2`) | Same app dashboard |
| `NEXT_PUBLIC_PUSHER_KEY` | Pusher key (client-side) | Same as `PUSHER_KEY` |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Pusher cluster (client-side) | Same as `PUSHER_CLUSTER` |
| `RESEND_API_KEY` | Email sending key | [resend.com](https://resend.com) — free 3000/mo |
| `RESEND_FROM` | Sender address | Your verified domain |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public token | [mapbox.com](https://mapbox.com) — free 50k loads/mo |
| `NEXT_PUBLIC_APP_URL` | App base URL (client-side) | Same as `NEXTAUTH_URL` |

## Deploying to Vercel

1. **Create Neon database**
   - Go to [neon.tech](https://neon.tech) → New project
   - Copy the `DATABASE_URL` (pooled connection string)

2. **Create Pusher app**
   - Go to [pusher.com](https://pusher.com) → Create app
   - Choose cluster closest to your users (`ap2` for Asia-Pacific)
   - Enable **Private channels** in app settings

3. **Get Mapbox token**
   - Go to [mapbox.com](https://mapbox.com) → Account → Tokens
   - Create a public token with `styles:read` and `tiles:read` scopes

4. **Get Resend API key**
   - Go to [resend.com](https://resend.com) → API Keys → Create
   - Add and verify your sending domain

5. **Deploy to Vercel**
   ```bash
   npm i -g vercel
   vercel
   ```
   Or connect the GitHub repo at [vercel.com](https://vercel.com)

6. **Set environment variables** in Vercel dashboard → Project → Settings → Environment Variables
   - Add all variables from the table above
   - Set `NEXTAUTH_URL` to your Vercel deployment URL (e.g. `https://ikiwi.vercel.app`)
   - Set `NEXT_PUBLIC_APP_URL` to the same URL

7. **Run database seed** after first deploy:
   ```bash
   vercel env pull .env.production.local
   npx dotenv -e .env.production.local -- npx prisma db push
   npx dotenv -e .env.production.local -- npx prisma db seed
   ```

## Project Structure

```
src/
├── app/
│   ├── (admin)/admin/     # Admin panel pages
│   ├── (auth)/            # Login + register pages
│   ├── (shop)/shop/       # Shop owner pages
│   └── api/               # API routes
├── components/
│   ├── admin/             # Admin-specific components
│   ├── shop/              # Shop-specific components
│   └── shared/            # Shared components (NotifBell, Logo)
├── lib/                   # Auth, DB, Pusher, utils
├── server/
│   └── actions/           # Server Actions (orders, prices, products, shops)
├── store/                 # Zustand stores (cart)
└── types/                 # Shared TypeScript types
```

## Features

### Shop Owner
- Browse product catalog with daily prices
- Add products to cart and place orders
- Real-time order status updates via Pusher
- View order history with expandable details
- Location-based shop profile

### Admin
- Dashboard with KPIs and pending orders queue
- Manage daily produce prices with trend indicators
- View all orders, update status, set actual delivery cost
- Approve or block shop registrations
- Delivery map with all shop locations (Mapbox)
- Real-time notifications for new orders via Pusher
