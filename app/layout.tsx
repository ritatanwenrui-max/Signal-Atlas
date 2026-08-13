import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: "Signal Atlas · 全球舆情雷达",
    description: "全球品牌新闻自动发现、长期归档、传播溯源与舆情分析平台。",
    metadataBase: new URL(origin),
    openGraph: {
      title: "Signal Atlas · 全球舆情雷达",
      description: "少量全球发现、免费媒体持续追踪、新闻长期归档、传播链路与情绪分析。",
      images: [`${origin}/og-v2.png`],
    },
    twitter: {
      card: "summary_large_image",
      title: "Signal Atlas · 全球舆情雷达",
      description: "少量全球发现、免费媒体持续追踪、新闻长期归档、传播链路与情绪分析。",
      images: [`${origin}/og-v2.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
