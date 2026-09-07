import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#20362e",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://ampsoria-solar-planner.midweek-tippers-5lv7.chatgpt.site"),
  title: "Ampsoria · วางแผนพลังงานบ้านและโซลาร์เซลล์",
  description:
    "จำลองบ้าน 3D เพิ่มเครื่องใช้ไฟฟ้าและรถ EV คำนวณค่าไฟ ออกแบบโซลาร์เซลล์ให้ตรงพฤติกรรมการใช้ไฟ และประมาณการขายไฟคืนรัฐ สร้างโดย Ampsoria",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    type: "website",
    url: "https://ampsoria-solar-planner.midweek-tippers-5lv7.chatgpt.site",
    locale: "th_TH",
    siteName: "Ampsoria Solar Planner",
    title: "พลังงานที่ใช่ สำหรับบ้านคุณ · Ampsoria",
    description:
      "รู้จักการใช้ไฟของคุณ เลือกโซลาร์ให้พอดี พร้อมจำลองบ้าน 3D และการชาร์จ EV",
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
