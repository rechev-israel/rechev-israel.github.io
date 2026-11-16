import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui";
export function Forbidden({ message }: { message: string }) {
  return <EmptyState title={message} icon={<ShieldAlert size={28} />} />;
}
