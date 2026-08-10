import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "نادي — إدارة الأندية",
  description: "منصة إدارة الأندية الرياضية: اشتراكات، تحضير، حجوزات",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              نادي
            </Link>
            <nav className="flex items-center gap-6 text-sm text-slate-600">
              <Link href="/" className="hover:text-emerald-700">الاستقبال</Link>
              <Link href="/schedule" className="hover:text-emerald-700">جدول الحصص</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
