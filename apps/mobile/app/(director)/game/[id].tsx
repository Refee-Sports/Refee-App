import React, { useCallback, useState } from "react";
import { Text, View, ActivityIndicator, FlatList, Alert, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ZebraRule } from "@/components/ui/ZebraRule";
import {
  fetchGameById,
  fetchGameApplicants,
  markNoShow,
  approveApplicant,
  declineApplicantForGame,
  fetchMyHirerId,
  submitRefereeRating,
  fetchExistingRating,
  completeGame,
  cancelGame,
  fetchGameRatedRefIds,
  CANCEL_FEE_WINDOW_HOURS,
  credentialsLine,
  type DirectorGameRow,
  type ApplicantRow,
  type CategoryRatings,
} from "@/lib/director/queries";
import { getOrCreateDM, postCrewNote, fetchCrewThread, type CrewThread } from "@/lib/messages/queries";
import { hasSeenLatest, seenCount } from "@/lib/messages/receipts";
import { RateRefereeModal } from "@/components/ratings/RateRefereeModal";
import { DirectorTabBar } from "@/components/director/DirectorTabBar";
import { supabase } from "@/lib/supabase";
import { useStripe } from "@/lib/payments/stripe";
import { startCrewPayment, confirmCrewPayout, runAutoPay } from "@/lib/payments/queries";
import { canOfferCrewPayment, paymentNeedsReview } from "@/lib/payments/status";
import { formatGameDate, formatGameTimeWithZone } from "@refee/core/time";
import { showRate } from "@refee/core/referee/reliability";
import { palette, choice } from "@refee/design";
import { BackButton } from "@/components/ui/Controls";
import { TextField } from "@/components/ui/TextField";
import { Tappable } from "@/components/ui/Tappable";
import { Button } from "@/components/ui/Button";
import { payoutDisplay, canRateReferee, type PayoutTone } from "@refee/core/director/game-status";

/** "SUN, SEP 20 · 1:30 PM ET" in the venue's zone. */
function fmtDatetime(iso: string, tz?: string | null) {
  const date = formatGameDate(iso, tz, { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  return `${date} · ${formatGameTimeWithZone(iso, tz)}`;
}

const PAYOUT_PANEL: Record<PayoutTone, string> = {
  paid: "border-court bg-court/10",
  held: "border-whistle bg-whistle/10",
  due: "border-ink-20 bg-chalk",
  overdue: "border-foul bg-foul/10",
  none: "",
};
const PAYOUT_TEXT: Record<PayoutTone, string> = {
  paid: "text-court-ink",
  held: "text-whistle-ink",
  due: "text-ink",
  overdue: "text-foul-ink",
  none: "",
};

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [game, setGame] = useState<DirectorGameRow | null>(null);
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratingTarget, setRatingTarget] = useState<ApplicantRow | null>(null);
  const [ratedRefIds, setRatedRefIds] = useState<Set<string>>(new Set());
  const [submittingRating, setSubmittingRating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [crewThread, setCrewThread] = useState<CrewThread | null>(null);

  const loadCrewThread = useCallback(async () => {
    if (!id) return;
    const { thread } = await fetchCrewThread(id);
    if (thread) setCrewThread(thread);
  }, [id]);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ game: g, error: gErr }, { applicants: apps, error: aErr }] = await Promise.all([
      fetchGameById(id),
      fetchGameApplicants(id),
    ]);
    setGame(g);
    setApplicants(apps);
    setError(gErr?.message ?? aErr?.message ?? null);
    setLoading(false);

    // which refs have I already rated for this game?
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const hirerId = await fetchMyHirerId(session.user.id);
      if (hirerId) setRatedRefIds(await fetchGameRatedRefIds(id, hirerId));
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    void load();
    void loadCrewThread();
  }, [load, loadCrewThread]));

  const handleMessageCrew = () => {
    Haptics.selectionAsync();
    setNoteText("");
    setNoteOpen(true);
  };

  const submitCrewNote = async () => {
    if (!id) return;
    const body = noteText.trim();
    if (!body) return;
    setPostingNote(true);
    const { error: err } = await postCrewNote(id, body);
    setPostingNote(false);
    if (err) {
      Alert.alert("Couldn't send", err.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNoteOpen(false);
    setNoteText("");
    void loadCrewThread();
  };

  const handleNoShow = (a: ApplicantRow) => {
    if (!id) return;
    const name = a.profile ? `${a.profile.first_name} ${a.profile.last_initial}.` : "this referee";
    Alert.alert(
      "Mark as no-show?",
      `${name} won't be paid for this game, and will be told. Only do this if they never arrived.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark No-Show",
          style: "destructive",
          onPress: async () => {
            const { error: nsErr } = await markNoShow(id, a.ref_id);
            if (nsErr) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Couldn't mark no-show", nsErr.message);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            void load();
          },
        },
      ]
    );
  };

  const handleMessageRef = async (refId: string) => {
    Haptics.selectionAsync();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { conversationId, error: err } = await getOrCreateDM(session.user.id, refId);
    if (err || !conversationId) {
      Alert.alert("Error", err?.message ?? "Could not open chat");
      return;
    }
    router.push(`/(director)/conversation/${conversationId}` as any);
  };

  const handleSubmitRating = async (scores: CategoryRatings, comment: string) => {
    if (!ratingTarget || !id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setSubmittingRating(true);
    const hirerId = await fetchMyHirerId(session.user.id);
    if (!hirerId) {
      setSubmittingRating(false);
      Alert.alert("Error", "Hirer profile not found");
      return;
    }
    const already = await fetchExistingRating(id, ratingTarget.ref_id, hirerId);
    if (already) {
      setSubmittingRating(false);
      setRatingTarget(null);
      Alert.alert("Already rated", "You've already rated this referee for this game.");
      return;
    }
    const { error: err } = await submitRefereeRating(id, ratingTarget.ref_id, hirerId, scores, comment);
    setSubmittingRating(false);
    if (err) {
      Alert.alert("Error", err.message);
    } else {
      setRatedRefIds((s) => new Set(s).add(ratingTarget.ref_id));
      setRatingTarget(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCompleteGame = () => {
    Haptics.selectionAsync();
    Alert.alert(
      "Mark game as completed?",
      "Confirmed referees will have their full pay locked in, and you'll be able to rate them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Completed",
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const { error: err } = await completeGame(id!, session.user.id);
            if (err) {
              Alert.alert("Error", err.message);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Auto-pay if a card is on file; otherwise PAY CREW stays visible
            const { result } = await runAutoPay(id!);
            if (result && result.paid.length > 0) {
              const p = result.paid[0];
              Alert.alert(
                "Crew paid automatically",
                p.held > 0
                  ? `$${p.total} charged. ${p.transferred} referee share${p.transferred !== 1 ? "s" : ""} transferred to Stripe; ${p.held} pending payout setup.`
                  : `$${p.total} charged and all ${p.transferred} referee${p.transferred !== 1 ? "s" : ""} paid.`
              );
            } else if (result?.reason === "no_card") {
              Alert.alert(
                "Game completed",
                "Tip: save a card under Profile → SET UP AUTO-PAY and crews get paid automatically. For now, use the PAY CREW button."
              );
            } else if (result && result.skipped.length > 0) {
              Alert.alert(
                "Auto-pay failed",
                `${result.skipped[0].reason}\n\nUse the PAY CREW button to pay manually.`
              );
            }
            await load();
          },
        },
      ]
    );
  };

  const handleCancelGame = () => {
    if (!game) return;
    Haptics.selectionAsync();
    const msToStart = new Date(game.starts_at).getTime() - Date.now();
    const lateCancel = msToStart < CANCEL_FEE_WINDOW_HOURS * 3_600_000;
    Alert.alert(
      "Cancel this game?",
      lateCancel
        ? `You're inside ${CANCEL_FEE_WINDOW_HOURS} hour${CANCEL_FEE_WINDOW_HOURS !== 1 ? "s" : ""} of tip-off. Confirmed referees will be owed a 50% cancellation fee.`
        : "Confirmed referees will be notified. No cancellation fees apply.",
      [
        { text: "Keep Game", style: "cancel" },
        {
          text: "Cancel Game",
          style: "destructive",
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const { error: err, feePaid, feeAmount } = await cancelGame(id!, session.user.id);
            if (err) {
              Alert.alert("Error", err.message);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            if (feePaid) {
              Alert.alert("Game cancelled", `Each confirmed referee is owed a $${feeAmount} cancellation fee.`);
            }
            await load();
          },
        },
      ]
    );
  };

  const handlePayCrew = async () => {
    if (!id || paying) return;
    Haptics.selectionAsync();
    setPaying(true);
    try {
      const { quote, error: qErr } = await startCrewPayment(id);
      if (qErr || !quote) {
        Alert.alert("Cannot start payment", qErr?.message ?? "Unknown error");
        return;
      }

      const { error: initErr } = await initPaymentSheet({
        paymentIntentClientSecret: quote.clientSecret,
        merchantDisplayName: "Refee",
        defaultBillingDetails: {},
      });
      if (initErr) {
        Alert.alert("Payment error", initErr.message);
        return;
      }

      const { error: sheetErr } = await presentPaymentSheet();
      if (sheetErr) {
        // user cancelled or card declined — nothing charged
        if (sheetErr.code !== "Canceled") Alert.alert("Payment failed", sheetErr.message);
        return;
      }

      const { transferred, held, error: payoutErr } = await confirmCrewPayout(id);
      if (payoutErr) {
        Alert.alert("Payment received, payout pending", payoutErr.message);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Crew paid",
        held > 0
          ? `${transferred} referee share${transferred !== 1 ? "s" : ""} transferred to Stripe. ${held} haven't set up payouts yet — their share is held and releases automatically once they onboard.`
          : `All ${transferred} referee${transferred !== 1 ? "s" : ""} paid.`
      );
      await load();
    } finally {
      setPaying(false);
    }
  };

  const handleApprove = async (refId: string) => {
    Haptics.selectionAsync();
    setActioning(refId);
    const { error: err } = await approveApplicant(id!, refId);
    if (err) {
      Alert.alert("Error", err.message);
    } else {
      setApplicants((prev) =>
        prev.map((a) => a.ref_id === refId ? { ...a, status: "accepted" } : a)
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setActioning(null);
  };

  const handleDecline = async (refId: string) => {
    Alert.alert(
      "Decline this referee?",
      "They'll be notified that this slot is no longer available.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setActioning(refId);
            const { error: err } = await declineApplicantForGame(id!, refId);
            if (err) {
              Alert.alert("Error", err.message);
            } else {
              setApplicants((prev) =>
                prev.map((a) => a.ref_id === refId ? { ...a, status: "declined" } : a)
              );
            }
            setActioning(null);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator color={palette.signal} />
      </View>
    );
  }

  if (!game) {
    return (
      <View className="flex-1 bg-paper items-center justify-center" style={{ paddingTop: insets.top }}>
        <Text className="text-ink font-mono-bold uppercase" style={{ letterSpacing: 1 }}>
          {error ?? "Game not found."}
        </Text>
      </View>
    );
  }

  const pending = applicants.filter((a) => a.status === "pending");
  const accepted = applicants.filter(
    (a) => a.status === "accepted" || a.status === "needs_reconfirm" || a.status === "completed"
  );
  const declined = applicants.filter((a) => a.status === "declined");
  // Refs who were confirmed and then dropped out or never showed. Directors used to
  // lose track of them entirely: they vanished from every section.
  const dropped = applicants.filter((a) => a.status === "withdrawn" || a.status === "no_show");
  const slotsLeft = Math.max(0, game.crew_size - accepted.length);
  const gameStarted = new Date(game.starts_at) <= new Date();
  const isCompleted = game.status === "completed";
  const isCancelled = game.status === "cancelled";
  const isClosed = isCompleted || isCancelled;
  const unratedCount = accepted.filter((a) => !ratedRefIds.has(a.ref_id)).length;
  const payout = payoutDisplay(game);
  const paymentLockedForReview = paymentNeedsReview(
    game.payment_status,
    game.payment_issue_requires_review
  );
  const showPayCrew = canOfferCrewPayment({
    isClosed,
    paymentStatus: game.payment_status,
    reviewRequired: game.payment_issue_requires_review,
    acceptedCrewCount: accepted.length,
  });

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
    <FlatList
      style={{ flex: 1, backgroundColor: palette.paper }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      ListHeaderComponent={
        <View style={{ paddingTop: insets.top }}>
          {/* Back */}
          <View className="px-5 py-3 flex-row items-center gap-3">
            <BackButton onPress={() => router.back()} />
            <Text
              className="font-mono-bold text-[10px] text-ink-60 uppercase flex-1"
              style={{ letterSpacing: 2 }}
            >
              GAME DETAIL
            </Text>
            <View className="mr-2">
              <Button
                label="Duplicate"
                variant="secondary"
                size="sm"
                accessibilityLabel="Duplicate game"
                icon={<Feather name="copy" size={12} color={palette.ink} />}
                onPress={() =>
                  // Same game, new date and time: everything else carries over.
                  router.push({
                    pathname: "/(director)/game/create" as any,
                    params: { copyFromId: id, ...(game.tournament_id ? { tournamentId: game.tournament_id } : {}) },
                  })
                }
              />
            </View>
            <Button
              label="Edit"
              variant="secondary"
              size="sm"
              icon={<Feather name="edit-2" size={12} color={palette.ink} />}
              onPress={() => router.push({ pathname: "/(director)/game/create" as any, params: { editId: id } })}
            />
          </View>

          {/* Game hero */}
          <View className="px-5 pb-3">
            <Text
              className="font-display text-ink uppercase"
              style={{ fontSize: 26, lineHeight: 24, letterSpacing: -1 }}
            >
              {game.title.toUpperCase()}
            </Text>
            <Text className="font-mono text-[10px] text-ink-60 uppercase mt-1.5" style={{ letterSpacing: 1.5 }}>
              {fmtDatetime(game.starts_at, game.timezone)}
            </Text>
            <Text className="font-mono text-[10px] text-ink-60 uppercase" style={{ letterSpacing: 1.5 }}>
              {game.venue_name.toUpperCase()} · {game.venue_city.toUpperCase()}, {game.venue_state}
            </Text>
          </View>
          <View className="px-5 mb-4">
            <ZebraRule thin />
          </View>

          {/* Specs */}
          <View className="mx-5 border border-ink bg-chalk flex-row mb-4">
            <SpecCell label="REFS NEEDED" value={String(game.crew_size)} />
            <View className="w-px bg-ink" />
            <SpecCell label="SLOTS LEFT" value={String(slotsLeft)} />
            <View className="w-px bg-ink" />
            <SpecCell label="PAY / REF" value={`$${game.pay_per_game}`} />
          </View>

          {/* Cancelled banner */}
          {isCancelled && (
            <View className="mx-5 mb-4 border border-foul bg-foul/10 px-4 py-3">
              <Text className="text-foul-ink font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 1.5 }}>
                ✕ GAME CANCELLED
              </Text>
            </View>
          )}

          {paymentLockedForReview && (
            <View className="mx-5 mb-4 border border-whistle bg-whistle/10 px-4 py-3">
              <Text className="text-whistle-ink font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 1.5 }}>
                ! PAYMENT REVIEW REQUIRED
              </Text>
              <Text className="text-ink font-mono text-[9px] uppercase mt-1" style={{ letterSpacing: 1 }}>
                {game.payment_review_reason === "refund"
                  ? "A REFUND WAS RECORDED. CREW PAY IS LOCKED WHILE SUPPORT REVIEWS TRANSFERS."
                  : "A PAYMENT DISPUTE WAS RECORDED. CREW PAY IS LOCKED WHILE SUPPORT REVIEWS IT."}
              </Text>
            </View>
          )}

          {/* Post-game rating prompt */}
          {isCompleted && unratedCount > 0 && (
            <View className="mx-5 mb-4 border border-ink bg-hi-vis px-4 py-3.5">
              <Text className="text-ink font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 1.5 }}>
                ✓ GAME COMPLETED — RATE YOUR CREW
              </Text>
              <Text className="text-ink font-mono text-[9px] uppercase mt-1" style={{ letterSpacing: 1 }}>
                {unratedCount} REFEREE{unratedCount !== 1 ? "S" : ""} AWAITING YOUR RATING BELOW
              </Text>
            </View>
          )}
          {isCompleted && unratedCount === 0 && accepted.length > 0 && (
            <View className="mx-5 mb-4 flex-row items-center gap-3 border border-court/30 bg-court/10 px-4 py-3.5">
              <View className="w-7 h-7 rounded-full bg-court items-center justify-center">
                <Feather name="check" size={15} color={palette.paper} />
              </View>
              <View className="flex-1">
                <Text className="font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 1.2, color: palette.court }}>
                  COMPLETED
                </Text>
                <Text className="font-mono text-[9px] uppercase text-ink-60 mt-0.5" style={{ letterSpacing: 1 }}>
                  All referees rated
                </Text>
              </View>
            </View>
          )}

          {/* Pay crew */}
          {showPayCrew && (
            <View className="mx-5 mb-4">
              <Button
                label="Pay crew"
                fullWidth
                icon={<Feather name="dollar-sign" size={14} color={palette.paper} />}
                loading={paying}
                loadingLabel="Paying crew"
                onPress={handlePayCrew}
              />
              <Text className="font-mono text-[8px] text-ink-40 uppercase mt-1.5 text-center" style={{ letterSpacing: 1 }}>
                CARD PAYMENT · REFS PAID VIA STRIPE · +5% PLATFORM FEE
              </Text>
            </View>
          )}
          {/* Where the crew's money stands — the same read as the payment-issues list. */}
          {isClosed && payout.tone !== "none" && (
            <View
              className={`mx-5 mb-4 flex-row items-center gap-3 rounded-lg border px-4 py-3.5 ${PAYOUT_PANEL[payout.tone]}`}
              accessibilityRole="summary"
            >
              <Feather
                name={payout.tone === "paid" ? "check-circle" : payout.tone === "overdue" ? "alert-circle" : "clock"}
                size={16}
                color={payout.tone === "paid" ? palette.courtInk : payout.tone === "overdue" ? palette.foulInk : palette.ink}
              />
              <View className="flex-1">
                <Text
                  className={`font-mono-bold text-[11px] uppercase ${PAYOUT_TEXT[payout.tone]}`}
                  style={{ letterSpacing: 1.2 }}
                >
                  {payout.tone === "paid" ? "Crew paid" : payout.label}
                </Text>
                {payout.tone === "paid" ? (
                  <Text className="text-ink-60 font-mono text-[9px] uppercase mt-0.5" style={{ letterSpacing: 1 }}>
                    Sent to referees via Stripe
                  </Text>
                ) : null}
              </View>
            </View>
          )}

          {/* Message crew */}
          {accepted.length > 0 && (
            <View className="mx-5 mb-4">
              <Button
                label="Send a crew message"
                fullWidth
                icon={<Feather name="send" size={14} color={palette.hiVis} />}
                onPress={handleMessageCrew}
              />
              <Text
                className="font-mono text-[8px] text-ink-40 uppercase mt-1.5 text-center"
                style={{ letterSpacing: 1 }}
              >
                ONLY CONFIRMED CREW CAN VIEW
              </Text>
            </View>
          )}

          {/* Sent crew messages + read receipts (director-only view) */}
          {crewThread && crewThread.messages.length > 0 && (
            <View className="mx-5 mb-4 border border-ink-20 bg-chalk">
              <View className="flex-row items-center justify-between px-3.5 py-2.5 border-b border-ink-20">
                <Text className="text-ink-60 font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.4 }}>
                  CREW MESSAGES
                </Text>
                <Text className="text-ink font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.2 }}>
                  <Text style={{ color: palette.court }}>
                    ✓ SEEN {seenCount(crewThread.receipts, crewThread.lastMessageAt)}/{crewThread.receipts.length}
                  </Text>
                </Text>
              </View>

              {crewThread.messages.map((m) => (
                <View key={m.id} className="px-3.5 py-2.5 border-b border-ink-20">
                  <Text className="text-ink font-mono text-[12px]">{m.body}</Text>
                  <Text className="text-ink-40 font-mono text-[8px] uppercase mt-1" style={{ letterSpacing: 1 }}>
                    {new Date(m.createdAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              ))}

              <View className="px-3.5 py-2.5 flex-row flex-wrap gap-x-3 gap-y-1.5">
                {crewThread.receipts.map((r) => {
                  const seen = hasSeenLatest(r.lastReadAt, crewThread.lastMessageAt);
                  return (
                    <View key={r.refId} className="flex-row items-center gap-1">
                      <Feather
                        name={seen ? "check-circle" : "circle"}
                        size={11}
                        color={seen ? palette.court : palette.ink40}
                      />
                      <Text
                        className="font-mono-bold text-[9px] uppercase"
                        style={{ letterSpacing: 0.8, color: seen ? palette.ink : palette.ink60 }}
                      >
                        {r.displayName}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Lifecycle actions */}
          {!isClosed && (
            <View className="mx-5 mb-4 gap-2">
              {gameStarted && (
                <Button
                  label="Mark game completed"
                  variant="court"
                  fullWidth
                  icon={<Feather name="check-circle" size={14} color={palette.ink} />}
                  onPress={handleCompleteGame}
                />
              )}
              <Button label="Cancel game" variant="danger" fullWidth onPress={handleCancelGame} />
            </View>
          )}

          {/* Details */}
          {(game.uniform_requirements || game.hirer_note || game.auto_accept) && (
            <View className="mx-5 mb-4 border border-ink-20 bg-chalk">
              {game.uniform_requirements && (
                <>
                  <DetailRow icon="shirt" label="UNIFORM" value={game.uniform_requirements} />
                  <View className="h-px bg-ink-20" />
                </>
              )}
              {game.hirer_note && (
                <>
                  <DetailRow icon="file-text" label="NOTES" value={game.hirer_note} />
                  {game.auto_accept && <View className="h-px bg-ink-20" />}
                </>
              )}
              {game.auto_accept && (
                <DetailRow icon="zap" label="AUTO-ACCEPT" value="ON — Referees are instantly accepted" />
              )}
            </View>
          )}

          {/* Sections */}
          <ApplicantSection
            title={`PENDING · ${pending.length}`}
            accentColor={palette.whistle}
            empty="No pending applications."
          >
            {pending.map((a) => (
              <ApplicantCard
                key={a.id}
                applicant={a}
                onApprove={() => handleApprove(a.ref_id)}
                onDecline={() => handleDecline(a.ref_id)}
                actioning={actioning === a.ref_id}
                onViewProfile={() => router.push(`/(director)/referee/${a.ref_id}` as any)}
                showActions
              />
            ))}
          </ApplicantSection>

          <ApplicantSection
            title={`ACCEPTED · ${accepted.length}`}
            accentColor={palette.court}
            empty="No accepted referees yet."
          >
            {accepted.map((a) => (
              <ApplicantCard
                key={a.id}
                applicant={a}
                onViewProfile={() => router.push(`/(director)/referee/${a.ref_id}` as any)}
                actioning={false}
                showActions={false}
                onMessage={() => handleMessageRef(a.ref_id)}
                onRate={canRateReferee(game, a.status) && !ratedRefIds.has(a.ref_id) ? () => setRatingTarget(a) : undefined}
                rated={ratedRefIds.has(a.ref_id)}
                onNoShow={gameStarted && !isCompleted && !isCancelled && (a.status === "accepted" || a.status === "needs_reconfirm") ? () => handleNoShow(a) : undefined}
              />
            ))}
          </ApplicantSection>

          {dropped.length > 0 && (
            <ApplicantSection
              title={`DROPPED · ${dropped.length}`}
              accentColor={palette.foulInk}
              empty=""
            >
              {dropped.map((a) => (
                <ApplicantCard
                  key={a.id}
                  applicant={a}
                  onViewProfile={() => router.push(`/(director)/referee/${a.ref_id}` as any)}
                  actioning={false}
                  showActions={false}
                />
              ))}
            </ApplicantSection>
          )}

          {declined.length > 0 && (
            <ApplicantSection
              title={`DECLINED · ${declined.length}`}
              accentColor={palette.ink40}
              empty=""
            >
              {declined.map((a) => (
                <ApplicantCard
                  key={a.id}
                  applicant={a}
                  onViewProfile={() => router.push(`/(director)/referee/${a.ref_id}` as any)}
                  actioning={false}
                  showActions={false}
                />
              ))}
            </ApplicantSection>
          )}
        </View>
      }
      data={[]}
      renderItem={null}
      ListFooterComponent={
        ratingTarget ? (
          <RateRefereeModal
            visible={!!ratingTarget}
            refName={
              ratingTarget.profile
                ? `${ratingTarget.profile.first_name} ${ratingTarget.profile.last_initial}.`
                : "Referee"
            }
            submitting={submittingRating}
            onSubmit={handleSubmitRating}
            onClose={() => setRatingTarget(null)}
          />
        ) : null
      }
    />
      <DirectorTabBar active="tournaments" />

      <Modal visible={noteOpen} transparent animationType="fade" onRequestClose={() => setNoteOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end"
          style={{ backgroundColor: palette.ink60 }}
        >
          <View className="bg-paper border-t-2 border-ink px-5 pt-5 pb-8">
            <Text className="text-ink font-display uppercase" style={{ fontSize: 20, letterSpacing: -0.5 }}>
              SEND A CREW MESSAGE
            </Text>
            <Text className="text-ink-60 font-mono text-[9px] uppercase mt-1 mb-3" style={{ letterSpacing: 1 }}>
              Note — crew messages can only be viewed by confirmed refs
            </Text>
            <TextField
              value={noteText}
              style={{ minHeight: 90, textAlignVertical: "top" }}
              onChangeText={setNoteText}
              placeholder="e.g. Arrive 30 min early, park behind the gym…"
              multiline
              autoFocus
              maxLength={4000}
            />
            <View className="flex-row gap-2 mt-4">
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="secondary" fullWidth onPress={() => setNoteOpen(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Send"
                  fullWidth
                  icon={<Feather name="send" size={13} color={palette.paper} />}
                  loading={postingNote}
                  loadingLabel="Sending"
                  disabled={noteText.trim().length === 0}
                  onPress={submitCrewNote}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 px-3 py-3 items-center">
      <Text className="font-mono text-[8px] text-ink-40 uppercase mb-0.5" style={{ letterSpacing: 2 }}>
        {label}
      </Text>
      <Text className="font-display text-ink" style={{ fontSize: 22, letterSpacing: -0.5 }}>
        {value}
      </Text>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View className="flex-row gap-3 px-4 py-3 items-start">
      <Feather name={icon} size={14} color={palette.ink60} style={{ marginTop: 1 }} />
      <View className="flex-1">
        <Text className="font-mono-bold text-[9px] text-ink-40 uppercase mb-0.5" style={{ letterSpacing: 2 }}>
          {label}
        </Text>
        <Text className="font-mono text-[11px] text-ink" style={{ lineHeight: 16 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ApplicantSection({
  title,
  accentColor,
  empty,
  children,
}: {
  title: string;
  accentColor: string;
  empty: string;
  children?: React.ReactNode;
}) {
  return (
    <View className="mx-5 mb-5">
      <View className="flex-row items-center gap-2 mb-2">
        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
        <Text
          className="font-mono-bold text-[10px] text-ink uppercase"
          style={{ letterSpacing: 2 }}
        >
          {title}
        </Text>
      </View>
      {React.Children.count(children) === 0 ? (
        <Text className="font-mono text-[10px] text-ink-40 uppercase px-1" style={{ letterSpacing: 1 }}>
          {empty}
        </Text>
      ) : (
        <View className="gap-2">{children}</View>
      )}
    </View>
  );
}

function ApplicantCard({
  applicant,
  onApprove,
  onDecline,
  onViewProfile,
  actioning,
  showActions,
  onMessage,
  onRate,
  rated,
  onNoShow,
}: {
  applicant: ApplicantRow;
  onApprove?: () => void;
  onDecline?: () => void;
  onViewProfile: () => void;
  actioning: boolean;
  showActions: boolean;
  onMessage?: () => void;
  onRate?: () => void;
  rated?: boolean;
  onNoShow?: () => void;
}) {
  const p = applicant.profile;
  const rate = showRate(applicant.reliability);
  const initials = p
    ? `${p.first_name[0] ?? "?"}${p.last_initial}`.toUpperCase()
    : "??";
  const displayName = p
    ? `${p.first_name} ${p.last_initial}.`.toUpperCase()
    : "UNKNOWN REF";

  const statusColor: Record<string, string> = {
    pending: palette.whistleInk,
    accepted: palette.courtInk,
    declined: palette.ink60,
    needs_reconfirm: palette.foulInk,
    completed: palette.courtInk,
    cancelled: palette.ink60,
    withdrawn: palette.foulInk,
    no_show: palette.foulInk,
  };

  const statusLabel: Record<string, string> = {
    needs_reconfirm: "AWAITING RE-CONFIRM",
    completed: "WORKED ✓",
    withdrawn: applicant.withdrew_late ? "WITHDREW (LATE)" : "WITHDREW",
    no_show: "NO-SHOW",
  };

  return (
    <View className="border border-ink bg-chalk rounded-lg overflow-hidden">
      <Tappable
        scaleTo={choice.scale.optionRow}
        style={({ pressed }) => ({ backgroundColor: pressed ? palette.chalkPress : undefined })}
        onPress={onViewProfile}
        accessibilityRole="button"
        accessibilityLabel={`View ${displayName}`}
        className="flex-row items-center gap-3 px-4 py-3.5"
      >
        {/* Avatar */}
        <View className="w-10 h-10 rounded-md bg-ink items-center justify-center">
          <Text className="text-paper font-mono-bold text-xs">{initials}</Text>
        </View>

        {/* Name + location */}
        <View className="flex-1">
          <Text className="font-mono-bold text-[12px] text-ink uppercase" style={{ letterSpacing: 0.5 }}>
            {displayName}
          </Text>
          {p && (
            <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 1 }}>
              {p.city.toUpperCase()}, {p.state} · ★ {p.rating.toFixed(2)}
            </Text>
          )}
          {credentialsLine(applicant.credentials) !== "" && (
            <Text className="font-mono text-[9px] text-ink uppercase mt-0.5" numberOfLines={1} style={{ letterSpacing: 1 }}>
              {credentialsLine(applicant.credentials)}
            </Text>
          )}
          {applicant.credentials?.leaguesWorked && (
            <Text className="font-mono text-[9px] text-ink-60 uppercase mt-0.5" numberOfLines={1} style={{ letterSpacing: 1 }}>
              LEAGUES: {applicant.credentials.leaguesWorked}
            </Text>
          )}
          <Text
            className={`font-mono text-[9px] uppercase mt-0.5 ${rate.rate != null && rate.rate < 90 ? "text-foul-ink" : "text-ink-60"}`}
            numberOfLines={1}
            style={{ letterSpacing: 1 }}
            accessibilityLabel={`${rate.label}. ${rate.detail}`}
          >
            {rate.label}{rate.rate != null && rate.rate < 100 ? ` · ${rate.detail}` : ""}
          </Text>
          {applicant.late_minutes != null && applicant.status === "accepted" && (
            <Text className="font-mono-bold text-[9px] uppercase mt-0.5" style={{ letterSpacing: 1, color: palette.foulInk }}>
              ⏱ RUNNING ~{applicant.late_minutes} MIN LATE
            </Text>
          )}
        </View>

        {/* Status */}
        <Text
          className="font-mono-bold text-[9px] uppercase"
          style={{ letterSpacing: 1.5, color: statusColor[applicant.status] ?? palette.ink }}
        >
          {statusLabel[applicant.status] ?? applicant.status.toUpperCase()}
        </Text>
      </Tappable>

      {showActions && (
        <View className="border-t border-ink-20 flex-row gap-2 px-4 py-3">
          <View style={{ flex: 1 }}>
            <Button label="Decline" variant="secondary" size="sm" fullWidth disabled={actioning} onPress={onDecline} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Accept" variant="court" size="sm" fullWidth loading={actioning} loadingLabel="Accepting" onPress={onApprove} />
          </View>
        </View>
      )}

      {!showActions && (onMessage || onRate || rated || onNoShow) && (
        <View className="border-t border-ink-20 flex-row gap-2 px-4 py-3">
          {onMessage && (
            <View style={{ flex: 1 }}>
              <Button
                label="Message"
                variant="secondary"
                size="sm"
                fullWidth
                icon={<Feather name="message-square" size={11} color={palette.ink} />}
                onPress={onMessage}
              />
            </View>
          )}
          {onRate && (
            <View style={{ flex: 1 }}>
              <Button
                label="Rate"
                size="sm"
                fullWidth
                icon={<Feather name="star" size={11} color={palette.hiVis} />}
                onPress={onRate}
              />
            </View>
          )}
          {onNoShow && (
            <View style={{ flex: 1 }}>
              <Button label="No-show" variant="danger" size="sm" fullWidth onPress={onNoShow} />
            </View>
          )}
          {rated && (
            <View className="flex-1 py-2.5 items-center flex-row justify-center gap-1.5">
              <Text style={{ color: palette.courtInk, fontSize: 10 }}>✓</Text>
              <Text className="font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5, color: palette.courtInk }}>
                RATED
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
