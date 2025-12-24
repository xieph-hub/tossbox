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

That's it! Just that code, nothing else. The error happened because you included this line in the file:
```
├── .env.local                       (Don't push this to GitHub!)
