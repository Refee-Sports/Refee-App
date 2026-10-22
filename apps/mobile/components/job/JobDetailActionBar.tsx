import { Text, View } from "react-native";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Button } from "@/components/ui/Button";
import type { AssignmentStatus } from "@/lib/jobs/queries";
import { palette } from "@refee/design";
import { TextLink } from "@/components/ui/Controls";
import { Feather } from "@expo/vector-icons";

type Props = {
  bottomInset: number;
  assignmentStatus: AssignmentStatus;
  actionLoading: boolean;
  canMutate: boolean;
  onDecline: () => void;
  onAccept: () => void;
  onMessageCrew?: () => void;
  onWithdraw?: () => void;
  /** Withdraws a pending application. */
  onCancelApplication?: () => void;
  /** Shown only around tip-off; reports a delay in minutes to the organizers. */
  onRunningLate?: (minutes: number) => void;
};

export function JobDetailActionBar({
  bottomInset,
  assignmentStatus,
  actionLoading,
  canMutate,
  onDecline,
  onAccept,
  onMessageCrew,
  onWithdraw,
  onCancelApplication,
  onRunningLate,
}: Props) {
  if (assignmentStatus === "accepted") {
    return (
      <View
        className="absolute left-0 right-0 border-t-[1.5px] border-ink bg-paper px-4 pt-3"
        style={{ bottom: 0, paddingBottom: bottomInset + 12 }}
      >
        <View className="absolute top-0 left-0 right-0 -mt-[1.5px]">
          <ZebraRule variant="signal" thin noMargin />
        </View>
        <View className="flex-row gap-2.5">
          <View className="flex-1 rounded-md bg-court/15 border border-court py-4 items-center justify-center">
            <Text className="text-court-ink font-mono-bold text-xs uppercase" style={{ letterSpacing: 2 }}>
              ACCEPTED · ON CREW
            </Text>
          </View>
          {onMessageCrew && (
            <Button
              label="Message crew"
              variant="primary"
              icon={<Feather name="message-square" size={14} color={palette.paper} />}
              onPress={onMessageCrew}
            />
          )}
        </View>
        {onRunningLate && (
          <View className="mt-2 flex-row items-center gap-2">
            <Text className="text-ink-60 font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
              RUNNING LATE?
            </Text>
            {[10, 15, 30].map((m) => (
              <View key={m} style={{ flex: 1 }}>
                <Button
                  label={`${m} min`}
                  variant="secondary"
                  size="sm"
                  fullWidth
                  disabled={actionLoading}
                  onPress={() => onRunningLate(m)}
                />
              </View>
            ))}
          </View>
        )}
        {onWithdraw && (
          <View className="mt-1">
            <TextLink label="Withdraw from this game" onPress={onWithdraw} />
          </View>
        )}
      </View>
    );
  }

  if (assignmentStatus === "needs_reconfirm") {
    return (
      <View
        className="absolute left-0 right-0 border-t-[1.5px] border-ink bg-paper px-4 pt-3"
        style={{ bottom: 0, paddingBottom: bottomInset + 12 }}
      >
        <View className="absolute top-0 left-0 right-0 -mt-[1.5px]">
          <ZebraRule variant="signal" thin noMargin />
        </View>
        <Text
          className="text-foul-ink font-mono-bold text-[10px] uppercase mb-2.5 text-center"
          style={{ letterSpacing: 1.5 }}
        >
          ⚠ THE ORGANIZER CHANGED THE TIME, VENUE, OR PAY
        </Text>
        <View className="flex-row gap-2.5">
          {/* Dropping out of a confirmed game is hard to undo: red. */}
          <Button label="Drop out" variant="danger" onPress={onDecline} disabled={actionLoading || !canMutate} />
          <View style={{ flex: 1 }}>
            <Button
              label="Re-confirm my spot"
              variant="court"
              showArrow
              fullWidth
              loading={actionLoading}
              loadingLabel="Re-confirming"
              disabled={!canMutate}
              onPress={onAccept}
            />
          </View>
        </View>
      </View>
    );
  }

  if (assignmentStatus === "declined") {
    return (
      <View
        className="absolute left-0 right-0 border-t-[1.5px] border-ink bg-paper px-4 pt-3"
        style={{ bottom: 0, paddingBottom: bottomInset + 12 }}
      >
        <View className="absolute top-0 left-0 right-0 -mt-[1.5px]">
          <ZebraRule variant="signal" thin noMargin />
        </View>
        <View className="rounded-md border border-ink-20 py-4 items-center">
          <Text className="text-ink-60 font-mono-bold text-xs uppercase" style={{ letterSpacing: 2 }}>
            DECLINED
          </Text>
        </View>
      </View>
    );
  }

  if (assignmentStatus === "pending") {
    return (
      <View
        className="absolute left-0 right-0 border-t-[1.5px] border-ink bg-paper px-4 pt-3"
        style={{ bottom: 0, paddingBottom: bottomInset + 12 }}
      >
        <View className="absolute top-0 left-0 right-0 -mt-[1.5px]">
          <ZebraRule variant="signal" thin noMargin />
        </View>
        <View className="rounded-md border border-ink-20 py-4 items-center">
          <Text className="text-ink-60 font-mono-bold text-xs uppercase" style={{ letterSpacing: 2 }}>
            APPLICATION PENDING
          </Text>
        </View>
        {onCancelApplication && (
          <View className="mt-1">
            <TextLink
              label="Cancel my application"
              onPress={onCancelApplication}
              disabled={actionLoading || !canMutate}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      className="absolute left-0 right-0 border-t-[1.5px] border-ink bg-paper px-4 pt-3"
      style={{ bottom: 0, paddingBottom: bottomInset + 12 }}
    >
      <View className="absolute top-0 left-0 right-0 -mt-[1.5px]">
        <ZebraRule variant="signal" thin noMargin />
      </View>
      <View className="flex-row gap-2.5">
        {/* Declining an offer is easy to undo: neutral, never red. */}
        <Button label="Decline" variant="secondary" onPress={onDecline} disabled={actionLoading || !canMutate} />
        <View style={{ flex: 1 }}>
          <Button
            label={assignmentStatus === "offered" ? "Accept assignment" : "Accept job"}
            variant="court"
            showArrow
            fullWidth
            loading={actionLoading}
            loadingLabel="Accepting"
            disabled={!canMutate}
            onPress={onAccept}
          />
        </View>
      </View>
    </View>
  );
}
