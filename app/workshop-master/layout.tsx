import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Workshop Master — Coach For Life",
  description: "Create workshops and manage registration responses in Coach For Life."
};

export default function WorkshopMasterLayout({ children }: { children: ReactNode }) {
  return children;
}
