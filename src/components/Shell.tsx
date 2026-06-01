import { ReactNode } from "react";
import TopRail from "./TopRail";
import FloatingCapture from "./FloatingCapture";

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.045),transparent_30%),radial-gradient(circle_at_80%_12%,rgba(255,255,255,0.025),transparent_34%),#000]">
      <TopRail />
      <main className="mx-auto max-w-[1980px] min-w-0 px-4 py-5 sm:px-5">{children}</main>
      <FloatingCapture />
    </div>
  );
}
