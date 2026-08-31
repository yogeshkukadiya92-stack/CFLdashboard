import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Workshop Attendance — Coach For Life",
  description: "Manage session attendance forms and participant attendance in Coach For Life."
};

export default function WorkshopAttendanceLayout({ children }: { children: ReactNode }) {
  return children;
}
