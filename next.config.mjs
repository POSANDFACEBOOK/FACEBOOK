/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.facebook.com' },
    ],
  },
}

export default nextConfig
```

กด Save

---

## สร้าง tsconfig.json
```
notepad tsconfig.json