import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ZebraRule } from "@/components/ui/ZebraRule";
import type { AssignmentStatus } from "@/lib/jobs/queries";

type Props = {
  bottomInset: number;
  assignmentStatus: AssignmentStatus;
  actionLoading: boolean;
  canMutate: boolean;
  onDecline: () => void;
  onAccept: () => void;
  onMessageCrew?: () => void;
  onWithdraw?: () => void;
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
          <View className="flex-1 bg-court/15 border border-court py-4 items-center justify-center">
            <Text className="text-court font-mono-bold text-xs uppercase" style={{ letterSpacing: 2 }}>
              ACCEPTED · ON CREW
            </Text>
          </View>
          {onMessageCrew && (
            <Pressable
              onPress={onMessageCrew}
              className="bg-ink px-5 items-center justify-center active:opacity-80"
            >
              <Text className="font-mono-bold text-[10px] uppercase text-center" style={{ letterSpacing: 1.5, color: "#C9F031" }}>
                MESSAGE{"\n"}CREW
              </Text>
            </Pressable>
          )}
        </View>
        {onWithdraw && (
          <Pressable onPress={onWithdraw} className="mt-2 py-2 items-center active:opacity-70">
            <Text
              className="text-ink-40 font-mono-bold text-[9px] uppercase underline"
              style={{ letterSpacing: 1.5 }}
            >
              WITHDRAW FROM THIS GAME
            </Text>
          </Pressable>
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
          className="text-foul font-mono-bold text-[10px] uppercase mb-2.5 text-center"
          style={{ letterSpacing: 1.5 }}
        >
          ⚠ THE ORGANIZER CHANGED THE TIME, VENUE, OR PAY
        </Text>
        <View className="flex-row gap-2.5">
          <Pressable
            onPress={onDecline}
            disabled={actionLoading || !canMutate}
            className="border-[1.5px] border-foul py-4 px-4 items-center justify-center active:opacity-80 disabled:opacity-40"
          >
            <Text className="text-foul font-mono-bold text-xs uppercase" style={{ letterSpacing: 1.4 }}>
              DROP OUT
            </Text>
          </Pressable>
          <Pressable
            onPress={onAccept}
            disabled={actionLoading || !canMutate}
            className="flex-1 bg-court py-4 items-center justify-center active:opacity-90 flex-row gap-2 disabled:opacity-40"
          >
            {actionLoading ? (
              <ActivityIndicator color="#E5E1D6" />
            ) : (
              <Text className="text-paper font-mono-bold text-xs uppercase" style={{ letterSpacing: 1.4 }}>
                RE-CONFIRM MY SPOT →
              </Text>
            )}
          </Pressable>
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
        <View className="border border-ink-20 py-4 items-center">
          <Text className="text-ink-60 font-mono-bold text-xs uppercase" style={{ letterSpacing: 2 }}>
            DECLINED
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className="absolute left-0 right-0 border-t-[1.5px] border-ink bg-paper px-4 pt-3"
      style={{ bottom: 0, paddingBottom: bottomInset + 12 }}
    >
      <View className="absolute top-0 left-0 right-0 -mt-[1.5px]">
        <ZebraRule variant="signal" thin />
      </View>
      <View className="flex-row gap-2.5">
        <Pressable
          onPress={onDecline}
          disabled={actionLoading || !canMutate}
          className="border-[1.5px] border-foul py-4 px-4 items-center justify-center active:opacity-80 disabled:opacity-40"
        >
          <Text className="text-foul font-mono-bold text-xs uppercase" style={{ letterSpacing: 1.4 }}>
            DECLINE
          </Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          disabled={actionLoading || !canMutate}
          className="flex-1 bg-court py-4 items-center justify-center active:opacity-90 flex-row gap-2 disabled:opacity-40"
        >
          {actionLoading ? (
            <ActivityIndicator color="#E5E1D6" />
          ) : (
            <>
              <Text className="text-paper font-mono-bold text-xs uppercase" style={{ letterSpacing: 1.4 }}>
                ACCEPT JOB
              </Text>
              <Text className="text-paper font-mono-bold text-base">→</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
