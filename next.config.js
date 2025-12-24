/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
}

module.exports = nextConfig
```

---

## **Complete file structure you need:**
```
tossbox/
├── .env.local                       (Don't push this to GitHub!)
├── .gitignore
├── package.json                     ✅
├── jsconfig.json                    ✅
├── next.config.js                   ✅ (NEW)
├── tailwind.config.js               ✅ (NEW)
├── postcss.config.js                ✅ (NEW)
├── vercel.json                      ✅
├── app/
│   ├── globals.css                  ✅ (NEW - This was missing!)
│   ├── layout.js                    ✅
│   ├── page.js                      ✅
│   ├── profile/page.js              ✅
│   ├── leaderboard/page.js          ✅
│   └── api/...                      ✅
├── lib/
│   ├── supabase.js                  ✅
│   └── solana.js                    ✅
├── components/
│   ├── TossBox.js                   ✅
│   └── WalletProvider.js            ✅
└── supabase/
    └── schema.sql                   ✅
```

---

## **Also create `.gitignore`** (important!):
```
# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
