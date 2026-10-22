import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CancelTournamentButton } from "@/components/director/CancelTournamentButton";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import {
  fetchAssignorTournament,
  fetchAssignorTournamentGames,
  fetchMyProposal,
  submitProposal,
  withdrawProposal,
  type AssignorGameRow,
  type MyProposalRow,
  type TournamentInviteRow,
} from "@/lib/assignor/queries";
import { palette } from "@refee/design";
import { BackButton, TextLink } from "@/components/ui/Controls";
import { TextField } from "@/components/ui/TextField";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Choice";

function formatWhen(value: string, timeZone: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).toUpperCase();
}

export default function AssignorTournamentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentInviteRow | null>(null);
  const [proposal, setProposal] = useState<MyProposalRow | null>(null);
  const [games, setGames] = useState<AssignorGameRow[]>([]);
  const [feeType, setFeeType] = useState<"flat" | "percentage">("flat");
  const [fee, setFee] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    setUserId(session.user.id);
    const [tournamentResult, proposalResult, gamesResult] = await Promise.all([
      fetchAssignorTournament(id, session.user.id),
      fetchMyProposal(id, session.user.id),
      fetchAssignorTournamentGames(id),
    ]);
    setTournament(tournamentResult.tournament);
    setProposal(proposalResult.proposal);
    setGames(gamesResult.games);
    const current = proposalResult.proposal;
    if (current) {
      setFeeType(current.fee_type);
      setFee(String(current.fee_type === "flat" ? current.fee_amount ?? "" : current.fee_pct ?? ""));
      setMessage(current.message ?? "");
    }
    setError(tournamentResult.error?.message ?? proposalResult.error?.message ?? gamesResult.error?.message ?? null);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const submit = async () => {
    if (!id || !userId || saving) return;
    const parsed = Number(fee);
    if (!Number.isFinite(parsed) || parsed <= 0 || (feeType === "percentage" && parsed > 100)) {
      Alert.alert("Check the fee", feeType === "flat" ? "Enter a flat fee greater than $0." : "Enter a percentage between 0 and 100.");
      return;
    }
    setSaving(true);
    const result = await submitProposal(id, userId, {
      feeType,
      feeAmount: feeType === "flat" ? parsed : undefined,
      feePct: feeType === "percentage" ? parsed : undefined,
      message: message.trim() || undefined,
    });
    setSaving(false);
    if (result.error) Alert.alert("Proposal not submitted", result.error.message);
    else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    }
  };

  const withdraw = () => {
    if (!proposal || !userId || saving) return;
    Alert.alert("Withdraw proposal?", "The director will no longer be able to accept this proposal.", [
      { text: "Keep", style: "cancel" },
      { text: "Withdraw", style: "destructive", onPress: () => {
        setSaving(true);
        void withdrawProposal(proposal.tournament_id, userId).then(async (result) => {
          setSaving(false);
          if (result.error) Alert.alert("Could not withdraw", result.error.message);
          else await load();
        });
      } },
    ]);
  };

  if (loading) return <View className="flex-1 bg-paper items-center justify-center"><ActivityIndicator color={palette.signal} /></View>;
  if (!tournament) return <View className="flex-1 bg-paper items-center justify-center px-6"><Text className="font-mono-bold text-ink text-center">TOURNAMENT NOT AVAILABLE</Text></View>;

  const accepted = tournament.assignor_status === "accepted";
  const proposalOpen = proposal && !["accepted", "declined", "withdrawn"].includes(proposal.status);

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-ink">
        <BackButton onPress={() => router.back()} />
        <Text className="font-mono-bold text-[9px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>TOURNAMENT</Text>
        <View className="w-9" />
      </View>

      <FlatList
        data={accepted ? games : []}
        keyExtractor={(game) => game.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
        ListHeaderComponent={(
          <View>
            <Text className="font-display text-ink uppercase mt-6" style={{ fontSize: 34, lineHeight: 34, letterSpacing: -1.2 }}>{tournament.name}</Text>
            <Text className="font-mono text-[9px] text-ink-60 uppercase mt-2" style={{ letterSpacing: 1 }}>
              {tournament.venue_city}, {tournament.venue_state} · {tournament.total_games ?? "—"} GAMES
            </Text>
            <View className={`border mt-5 px-4 py-3 ${accepted ? "border-court bg-court/10" : "border-signal bg-signal-tint"}`}>
              <Text className="font-mono-bold text-[10px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
                {accepted ? "✓ YOU ARE THE ASSIGNOR" : `STATUS · ${proposal?.status ?? tournament.assignor_status}`}
              </Text>
            </View>

            {!accepted && proposalOpen && (
              <View className="mt-5 rounded-lg border border-ink bg-chalk p-4">
                <Text className="font-mono-bold text-[10px] text-ink uppercase mb-3" style={{ letterSpacing: 1.5 }}>YOUR PROPOSAL</Text>
                <View className="flex-row gap-1.5 mb-3">
                  {(["flat", "percentage"] as const).map((type) => (
                    <Chip key={type} label={type === "flat" ? "Flat" : "Percentage"} selected={feeType === type} onPress={() => setFeeType(type)} />
                  ))}
                </View>
                <View className="mb-3">
                  <TextField value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder={feeType === "flat" ? "FLAT FEE ($)" : "PERCENTAGE (%)"} />
                </View>
                <View className="mb-3">
                  <TextField value={message} onChangeText={setMessage} multiline placeholder="OPTIONAL NOTE TO DIRECTOR" textAlignVertical="top" style={{ minHeight: 76 }} />
                </View>
                <Button label="Submit proposal" fullWidth loading={saving} loadingLabel="Submitting" onPress={() => void submit()} />
                {proposal?.status === "submitted" && <TextLink label="Withdraw proposal" tone="danger" onPress={withdraw} />}
              </View>
            )}

            {accepted && (
              <View className="flex-row items-center justify-between mt-6 mb-2">
                <Text className="font-mono-bold text-[10px] text-ink uppercase" style={{ letterSpacing: 2 }}>── GAME STAFFING ({games.length})</Text>
                <Button
                  label="Import CSV"
                  variant="secondary"
                  size="sm"
                  icon={<Feather name="upload" size={12} color={palette.ink} />}
                  onPress={() => router.push({ pathname: "/(assignor)/tournament/import" as any, params: { tournamentId: id } })}
                />
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={accepted ? <Text className="font-mono text-[9px] text-ink-40 uppercase text-center py-10">No games have been added yet.</Text> : null}
        ListFooterComponent={accepted ? (
          <CancelTournamentButton
            tournamentId={id}
            userId={userId}
            status={tournament.status ?? "open"}
            onCancelled={() => void load()}
          />
        ) : null}
        renderItem={({ item }) => (
          <View className="mb-2">
            <Card
              onPress={() => router.push(`/(assignor)/game/${item.id}` as any)}
              accessibilityLabel={item.title}
            >
              <View className="px-4 py-3">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-3">
                    <Text className="font-mono-bold text-[11px] text-ink uppercase" numberOfLines={1}>{item.title}</Text>
                    <Text className="font-mono text-[8px] text-ink-60 uppercase mt-1" style={{ letterSpacing: 0.8 }}>{formatWhen(item.starts_at, tournament.timezone)} · {item.venue_name}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-mono-bold text-[8px] text-signal uppercase">{item.status}</Text>
                    <Text className="font-mono text-[8px] text-ink-60 uppercase mt-1">{item.crew_size} REFS</Text>
                  </View>
                </View>
              </View>
            </Card>
          </View>
        )}
      />
      {error && <Text className="text-foul-ink font-mono text-[10px] text-center px-5 mb-4 uppercase">{error}</Text>}
    </View>
  );
}
