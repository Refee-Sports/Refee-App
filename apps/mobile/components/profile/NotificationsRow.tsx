
import { useRouter } from "expo-router";
import { ListRow } from "@/components/ui/Controls";

/** The row on every profile that opens the notification switches. */
export function NotificationsRow() {
  const router = useRouter();
  return (
    <ListRow
      label="Notifications"
      sublabel="CHOOSE WHAT WE PUSH TO YOUR PHONE"
      onPress={() => router.push("/notifications" as any)}
    />
  );
}
