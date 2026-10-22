import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { JobDetailActionBar } from "@/components/job/JobDetailActionBar";
import { JobDetailCrew } from "@/components/job/JobDetailCrew";
import { JobDetailGames } from "@/components/job/JobDetailGames";
import { JobDetailHeader } from "@/components/job/JobDetailHeader";
import { JobDetailHero } from "@/components/job/JobDetailHero";
import { JobDetailHirerNote } from "@/components/job/JobDetailHirerNote";
import { JobDetailMapCard } from "@/components/job/JobDetailMapCard";
import { JobDetailScheduleCard } from "@/components/job/JobDetailScheduleCard";
import { JobDetailSpecs } from "@/components/job/JobDetailSpecs";
import { JobDetailTelemetry } from "@/components/job/JobDetailTelemetry";
import { useJobAssignment } from "@/hooks/useJobAssignment";
import { useJobDetail } from "@/hooks/useJobsFeed";
import { supabase } from "@/lib/supabase";
import { getOrCreateCrewConversation } from "@/lib/messages/queries";
import { withdrawFromJob, isLateWithdrawal, reportRunningLate, canReportRunningLate, canWithdraw } from "@/lib/jobs/queries";
import { jobAvailability } from "@refee/core/jobs/availability";
import { palette } from "@refee/design";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/Controls";

const ACTION_BAR_HEIGHT = 88;

export default function JobDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { job, loading, error } = useJobDetail(id);
  const {
    status: assignmentStatus,
    crewMembers,
    loading: assignmentLoading,
    actionLoading,
    error: assignmentError,
    accept,
    decline,
    canMutate,
  } = useJobAssignment(id);

  const handleAccept = async () => {
    if (!canMutate) {
      Alert.alert(
        "Cannot accept",
        assignmentError ?? "Sign in again after resetting the local database."
      );
      return;
    }
    const { error: acceptError } = await accept();
    if (acceptError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (/verify your id/i.test(acceptError.message)) {
        Alert.alert("Verify your ID first", acceptError.message, [
          { text: "Not now", style: "cancel" },
          { text: "Verify now", onPress: () => router.push("/verify") },
        ]);
        return;
      }
      Alert.alert("Could not accept job", acceptError.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(app)/(tabs)");
  };

  const handleMessageCrew = async () => {
    Haptics.selectionAsync();
    if (!id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { conversationId, error: convoErr } = await getOrCreateCrewConversation(
      session.user.id,
      id
    );
    if (convoErr || !conversationId) {
      Alert.alert("Error", convoErr?.message ?? "Could not open crew chat");
      return;
    }
    router.push(`/(app)/conversation/${conversationId}` as any);
  };

  const handleWithdraw = () => {
    if (!id || !job) return;
    Haptics.selectionAsync();
    const late = job.startsAtIso ? isLateWithdrawal(job.startsAtIso) : false;
    Alert.alert(
      "Withdraw from this game?",
      late
        ? "⚠ Tip-off is less than 48 hours away. Withdrawing now lowers the show rate directors see when you apply."
        : "You're more than 48 hours out, so this won't affect your show rate. The slot reopens for other refs.",
      [
        { text: "Stay On Crew", style: "cancel" },
        {
          text: late ? "Withdraw Anyway" : "Withdraw",
          style: "destructive",
          onPress: async () => {
            const { error: wErr } = await withdrawFromJob(supabase, id);
            if (wErr) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Could not withdraw", wErr.message);
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.replace("/(app)/(tabs)");
          },
        },
      ]
    );
  };

  const handleRunningLate = async (minutes: number) => {
    if (!id) return;
    Haptics.selectionAsync();
    const { error: lateErr } = await reportRunningLate(supabase, id, minutes);
    if (lateErr) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Couldn't send", lateErr.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Organizer notified", `They know you're about ${minutes} minutes late.`);
  };

  const handleCancelApplication = () => {
    Alert.alert(
      "Cancel your application?",
      "The organizer will no longer see you as an applicant for this game.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel application",
          style: "destructive",
          onPress: async () => {
            const { error: cancelError } = await decline();
            if (cancelError) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Could not cancel", cancelError.message);
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.back();
          },
        },
      ]
    );
  };

  const handleDecline = () => {
    if (!canMutate) {
      Alert.alert(
        "Cannot decline",
        assignmentError ?? "Sign in again after resetting the local database."
      );
      return;
    }
    Alert.alert(
      "Decline this job?",
      "You can still browse other open assignments.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            const { error: declineError } = await decline();
            if (declineError) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Could not decline", declineError.message);
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.back();
          },
        },
      ]
    );
  };

  if (loading || assignmentLoading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center">
        <StatusBar style="dark" />
        <ActivityIndicator color={palette.signal} size="large" />
        <Text
          className="text-ink-60 font-mono-bold text-[10px] uppercase mt-4"
          style={{ letterSpacing: 2 }}
        >
          LOADING…
        </Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View className="flex-1 bg-paper">
        <StatusBar style="dark" />
        <View style={{ height: insets.top }} />
        <View className="px-5 pt-4">
          <View className="mb-6">
            <BackButton onPress={() => router.back()} />
          </View>
          <Text
            className="text-ink font-display uppercase"
            style={{ fontSize: 22, letterSpacing: -0.5 }}
          >
            JOB NOT FOUND
          </Text>
          <Text className="text-ink-60 font-mono text-xs uppercase mt-3">
            {error ?? `No job for id ${id ?? "—"}.`}
          </Text>
        </View>
      </View>
    );
  }

  // Opened from an old notification or a stale list, the last spot may be gone.
  // Someone already on the game still sees their own actions (withdraw, chat).
  const confirmedCount = crewMembers.filter((m) => m.status === "● LOCKED").length;
  const availability = jobAvailability({
    status: job.status,
    startsAtIso: job.startsAtIso,
    crewSize: job.crewSize,
    confirmedCount,
  });
  const hasStake = ["accepted", "pending", "offered", "needs_reconfirm"].includes(assignmentStatus ?? "");
  const unavailable = !availability.available && !hasStake;

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" />
      <View style={{ height: insets.top }} />

      <JobDetailHeader jobCode={job.jobCode} onBack={() => router.back()} />
      <JobDetailTelemetry job={job} />
      <View className="px-5">
        <ZebraRule variant="signal" thin noMargin />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + ACTION_BAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {!availability.available && unavailable ? (
          <View className="mt-4 border border-foul bg-foul/10 px-4 py-3" accessibilityRole="alert">
            <Text className="font-mono-bold text-[10px] text-foul-ink uppercase" style={{ letterSpacing: 1.5 }}>
              NO LONGER AVAILABLE
            </Text>
            <Text className="text-ink-80 mt-1" style={{ fontSize: 13, lineHeight: 18 }}>
              {availability.message}
            </Text>
          </View>
        ) : null}
        <JobDetailHero job={job} />
        <JobDetailScheduleCard job={job} />
        <JobDetailMapCard job={job} />
        <JobDetailCrew
          job={job}
          assignmentStatus={assignmentStatus}
          crewMembers={crewMembers}
        />
        <JobDetailGames job={job} />
        <JobDetailSpecs job={job} />
        {job.hirerNote ? <JobDetailHirerNote note={job.hirerNote} /> : <View className="h-2" />}
      </ScrollView>

      {unavailable ? (
        <View className="border-t border-ink bg-paper px-5 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <Button label="Back to games" variant="secondary" fullWidth onPress={() => router.replace("/(app)/(tabs)/jobs" as never)} />
        </View>
      ) : (
      <JobDetailActionBar
        bottomInset={insets.bottom}
        assignmentStatus={assignmentStatus}
        actionLoading={actionLoading}
        canMutate={canMutate}
        onDecline={handleDecline}
        onAccept={() => void handleAccept()}
        onMessageCrew={() => void handleMessageCrew()}
        onWithdraw={job?.startsAtIso && canWithdraw(job.startsAtIso) ? handleWithdraw : undefined}
        onCancelApplication={handleCancelApplication}
        onRunningLate={
          job?.startsAtIso && canReportRunningLate(job.startsAtIso, job.durationMinutes)
            ? (m) => void handleRunningLate(m)
            : undefined
        }
      />
      )}
    </View>
  );
}
