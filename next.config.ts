import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // مخرَج مستقل يضم الاعتماديات اللازمة فقط — يصغّر صورة الحاوية
  // ويجعل التشغيل على أي سيرفر: node server.js
  output: "standalone",
};

export default nextConfig;
