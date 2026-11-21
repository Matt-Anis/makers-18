import type { Viewport } from "next";
import { SessionWorkspace } from "@/features/workspace/session-workspace";

export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

export default function ChatPage() {
  return <SessionWorkspace />;
}
