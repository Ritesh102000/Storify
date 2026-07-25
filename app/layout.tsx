import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const description =
  "Create a living audio-story world where choices become character memories.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "Pocket Multiverse",
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Pocket Multiverse",
      description,
      type: "website",
      images: [{ url: imageUrl, width: 1734, height: 907 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Pocket Multiverse",
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
