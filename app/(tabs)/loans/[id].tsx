import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { getApiErrorMessage, getLoanDetail, Loan } from "@/services/loans";

function toNum(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatKes(value?: string | number | null) {
  const n = toNum(value);
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function statusText(status?: string | null) {
  if (!status) return "—";
  return String(status).replaceAll("_", " ");
}

function getStatusColors(status?: string | null) {
  const s = String(status || "").toUpperCase();

  if (s === "APPROVED") {
    return {
      bg: "rgba(140,240,199,0.18)",
      color: "#FFFFFF",
    };
  }

  if (s === "COMPLETED") {
    return {
      bg: "rgba(236,251,255,0.18)",
      color: "#FFFFFF",
    };
  }

  if (s === "REJECTED" || s === "DEFAULTED" || s === "CANCELLED") {
    return {
      bg: "rgba(220,53,69,0.18)",
      color: "#FFFFFF",
    };
  }

  if (s === "UNDER_REVIEW") {
    return {
      bg: "rgba(12,192,183,0.18)",
      color: "#FFFFFF",
    };
  }

  return {
    bg: "rgba(255,204,102,0.18)",
    color: "#FFFFFF",
  };
}

function StatusPill({ status }: { status: string }) {
  const { bg, color } = getStatusColors(status);

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>
        {String(statusText(status)).toUpperCase()}
      </Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.kvRow}>
      <Text style={[styles.kLabel, strong && styles.kLabelStrong]}>{label}</Text>
      <Text style={[styles.kValue, strong && styles.kValueStrong]}>{value}</Text>
    </View>
  );
}

function productLabel(loan?: Loan | null) {
  if (!loan) return "—";
  return loan.product_detail?.name || loan.product_name || "Support plan";
}

export default function LoanDetailScreen() {
  const params = useLocalSearchParams();

  const rawId =
    (Array.isArray(params.id) ? params.id[0] : params.id) ||
    (Array.isArray(params.loan) ? params.loan[0] : params.loan) ||
    (Array.isArray(params.loanId) ? params.loanId[0] : params.loanId) ||
    (Array.isArray(params.Id) ? params.Id[0] : params.Id);

  const loanId = rawId ? Number(rawId) : NaN;

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!Number.isFinite(loanId) || loanId <= 0) {
      setLoan(null);
      setError("This support record could not be opened.");
      return;
    }

    try {
      setError("");
      const data = await getLoanDetail(loanId);
      setLoan(data);
    } catch (e: any) {
      setLoan(null);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    }
  }, [loanId]);

  const initialLoad = useCallback(async () => {
    try {
      setLoading(true);
      await load();
    } finally {
      setLoading(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      initialLoad();
    }, [initialLoad])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const isPendingOrReview = useMemo(() => {
    const s = String(loan?.status || "").toUpperCase();
    return s === "PENDING" || s === "UNDER_REVIEW";
  }, [loan?.status]);

  const canPay = useMemo(() => {
    const s = String(loan?.status || "").toUpperCase();
    const outstanding = toNum(loan?.outstanding_balance);
    return (s === "APPROVED" || s === "DEFAULTED") && outstanding > 0;
  }, [loan?.status, loan?.outstanding_balance]);

  const guarantors = useMemo(() => {
    return Array.isArray(loan?.guarantors) ? loan.guarantors : [];
  }, [loan]);

  const installments = useMemo(() => {
    return Array.isArray(loan?.installments) ? loan.installments : [];
  }, [loan]);

  const payments = useMemo(() => {
    return Array.isArray(loan?.payments) ? loan.payments : [];
  }, [loan]);

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Support received",
        value: formatKes(loan?.principal),
        tone: "primary",
        icon: "heart-outline" as const,
      },
      {
        label: "Balance remaining",
        value: formatKes(loan?.outstanding_balance ?? "0.00"),
        tone: "warning",
        icon: "wallet-outline" as const,
      },
      {
        label: "Amount settled",
        value: formatKes(loan?.total_paid ?? "0.00"),
        tone: "success",
        icon: "checkmark-circle-outline" as const,
      },
      {
        label: "Repayment period",
        value: loan?.term_weeks ? `${loan.term_weeks} week(s)` : "—",
        tone: "info",
        icon: "calendar-outline" as const,
      },
    ];
  }, [loan]);

  if (loading && !loan) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#8CF0C7" />
        </View>
      </SafeAreaView>
    );
  }

  if (!Number.isFinite(loanId) || loanId <= 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <EmptyState
            title="Support not available"
            subtitle="This support record could not be opened."
          />
          <View style={{ marginTop: SPACING.md }}>
            <Button
              title="Back to Support"
              variant="secondary"
              onPress={() => router.replace("/(tabs)/loans" as any)}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8CF0C7"
            colors={["#8CF0C7", "#0CC0B7"]}
          />
        }
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.hero}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />
          <View style={styles.heroGlowThird} />

          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="heart-outline" size={20} color={COLORS.white} />
            </View>

            {loan?.status ? <StatusPill status={loan.status} /> : null}
          </View>

          <Text style={styles.heroTag}>SUPPORT DETAILS</Text>
          <Text style={styles.heroTitle}>Support details</Text>
          <Text style={styles.heroSub}>
            {productLabel(loan)}
            {loan?.term_weeks ? ` • ${loan.term_weeks} week(s)` : ""}
          </Text>

          <View style={styles.heroMiniWrap}>
            <View style={styles.heroMiniPill}>
              <Ionicons name="wallet-outline" size={14} color={COLORS.white} />
              <Text style={styles.heroMiniText}>
                {formatKes(loan?.outstanding_balance ?? "0.00")} remaining
              </Text>
            </View>

            <View style={styles.heroMiniPill}>
              <Ionicons
                name="checkmark-done-outline"
                size={14}
                color={COLORS.white}
              />
              <Text style={styles.heroMiniText}>
                {formatKes(loan?.total_paid ?? "0.00")} settled
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <Section title="Overview">
          <View style={styles.summaryGrid}>
            {summaryCards.map((item, index) => {
              const toneStyle =
                item.tone === "success"
                  ? styles.summaryCardSuccess
                  : item.tone === "warning"
                  ? styles.summaryCardWarning
                  : item.tone === "info"
                  ? styles.summaryCardInfo
                  : styles.summaryCardPrimary;

              const valueToneStyle =
                item.tone === "success"
                  ? styles.summaryValueSuccess
                  : item.tone === "warning"
                  ? styles.summaryValueWarning
                  : item.tone === "info"
                  ? styles.summaryValueInfo
                  : styles.summaryValuePrimary;

              const iconBg =
                item.tone === "success"
                  ? "rgba(236,255,235,0.92)"
                  : item.tone === "warning"
                  ? "rgba(255,244,228,0.92)"
                  : item.tone === "info"
                  ? "rgba(236,251,255,0.92)"
                  : "rgba(236,251,255,0.92)";

              const iconColor =
                item.tone === "success"
                  ? COLORS.success
                  : item.tone === "warning"
                  ? COLORS.accent
                  : item.tone === "info"
                  ? COLORS.info
                  : COLORS.primary;

              return (
                <Card
                  key={`${item.label}-${index}`}
                  style={[styles.summaryCard, toneStyle]}
                >
                  <View style={styles.summaryTopRow}>
                    <View
                      style={[
                        styles.summaryIconWrap,
                        { backgroundColor: iconBg },
                      ]}
                    >
                      <Ionicons name={item.icon} size={16} color={iconColor} />
                    </View>
                  </View>

                  <Text style={styles.summaryLabel}>{item.label}</Text>
                  <Text style={[styles.summaryValue, valueToneStyle]}>
                    {item.value}
                  </Text>
                </Card>
              );
            })}
          </View>
        </Section>

        <Section title="Support information">
          <Card style={styles.card}>
            {!loan ? (
              <EmptyState
                title="Support not found"
                subtitle="Please refresh and try again."
              />
            ) : (
              <View style={styles.group}>
                <DetailRow
                  label="Total payable"
                  value={
                    toNum(loan.total_payable) > 0
                      ? formatKes(loan.total_payable)
                      : "Pending review"
                  }
                  strong
                />
                <DetailRow label="Status" value={statusText(loan.status)} />
                <DetailRow label="Plan" value={productLabel(loan)} />
                <DetailRow
                  label="Created"
                  value={formatDateTime(loan.created_at)}
                />
                <DetailRow
                  label="Approved"
                  value={formatDateTime(loan.approved_at)}
                />
                <DetailRow
                  label="Rejected"
                  value={formatDateTime(loan.rejected_at)}
                />
                <DetailRow
                  label="Completed"
                  value={formatDateTime(loan.completed_at)}
                />
              </View>
            )}
          </Card>
        </Section>

        <Section title="People supporting this request">
          <Card style={styles.card}>
            {!loan ? (
              <Text style={styles.muted}>—</Text>
            ) : guarantors.length === 0 ? (
              <Text style={styles.muted}>No guarantors added yet.</Text>
            ) : (
              <View style={styles.group}>
                {guarantors.map((g) => (
                  <View key={g.id} style={styles.listRow}>
                    <View style={styles.listIconWrap}>
                      <Ionicons
                        name={g.accepted ? "checkmark-circle" : "time-outline"}
                        size={18}
                        color={g.accepted ? COLORS.success : COLORS.accent}
                      />
                    </View>

                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.listTitle}>
                        {g.guarantor_detail?.full_name || "Community member"}
                      </Text>
                      <Text style={styles.listSub}>
                        {g.accepted ? "Accepted" : "Pending response"}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.smallBadge,
                        { color: g.accepted ? "#8CF0C7" : "#FFD166" },
                      ]}
                    >
                      {g.accepted ? "ACCEPTED" : "PENDING"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </Section>

        <Section title="Repayment schedule">
          <Card style={styles.card}>
            {!loan ? (
              <Text style={styles.muted}>—</Text>
            ) : installments.length === 0 ? (
              <Text style={styles.muted}>
                Repayment steps will appear after approval.
              </Text>
            ) : (
              <View style={styles.group}>
                {installments.map((inst) => (
                  <View key={inst.id} style={styles.listRow}>
                    <View style={styles.listIconWrap}>
                      <Ionicons
                        name={
                          inst.is_paid
                            ? "checkmark-done-circle"
                            : "calendar-outline"
                        }
                        size={18}
                        color={inst.is_paid ? COLORS.success : COLORS.primary}
                      />
                    </View>

                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.listTitle}>
                        Installment {inst.installment_no}
                      </Text>
                      <Text style={styles.listSub}>
                        Due {formatDateTime(inst.due_date)}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.listAmount}>
                        {formatKes(inst.total_due)}
                      </Text>
                      <Text style={styles.listMeta}>
                        {inst.is_paid ? "Paid" : "Pending"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </Section>

        <Section title="Payments made">
          <Card style={styles.card}>
            {!loan ? (
              <Text style={styles.muted}>—</Text>
            ) : payments.length === 0 ? (
              <Text style={styles.muted}>No payments recorded yet.</Text>
            ) : (
              <View style={styles.group}>
                {payments.map((p) => (
                  <View key={p.id} style={styles.listRow}>
                    <View style={styles.listIconWrap}>
                      <Ionicons
                        name="cash-outline"
                        size={18}
                        color={COLORS.primary}
                      />
                    </View>

                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.listTitle}>{formatKes(p.amount)}</Text>
                      <Text style={styles.listSub}>
                        {p.method}
                        {p.reference ? ` • ${p.reference}` : ""}
                      </Text>
                    </View>

                    <Text style={styles.listMeta}>
                      {formatDateTime(p.paid_at)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </Section>

        {loan?.member_note || loan?.admin_note ? (
          <Section title="Notes">
            <Card style={styles.card}>
              <View style={styles.group}>
                {loan.member_note ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteTitle}>Your note</Text>
                    <Text style={styles.noteText}>{loan.member_note}</Text>
                  </View>
                ) : null}

                {loan.admin_note ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteTitle}>Admin note</Text>
                    <Text style={styles.noteText}>{loan.admin_note}</Text>
                  </View>
                ) : null}
              </View>
            </Card>
          </Section>
        ) : null}

        <Section title="Actions">
          <View style={{ gap: SPACING.sm }}>
            <Button
              title="Add guarantor"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/loans/add-guarantor" as any,
                  params: { loan: String(loanId) },
                })
              }
              disabled={!isPendingOrReview}
            />

            <Button
              title="Make payment"
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/loans/pay" as any,
                  params: {
                    loan: String(loanId),
                    due: String(loan?.outstanding_balance ?? "0.00"),
                  },
                })
              }
              disabled={!canPay}
            />

            <Button
              title="Back to support"
              variant="secondary"
              onPress={() => router.back()}
            />
          </View>

          <View style={styles.hintRow}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="rgba(255,255,255,0.78)"
            />
            <Text style={styles.hintText}>
              Payment updates may take a short moment to reflect after
              confirmation.
            </Text>
          </View>
        </Section>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  container: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C6A80",
  },

  center: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: "center",
    backgroundColor: "#0C6A80",
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 240,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -120,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 120,
    right: 20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 160,
    left: 10,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(140,240,199,0.08)",
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.lg,
    backgroundColor: "rgba(49, 180, 217, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.15)",
    padding: SPACING.lg,
    ...SHADOW.card,
  },

  heroGlowPrimary: {
    position: "absolute",
    right: -25,
    top: -24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  heroGlowAccent: {
    position: "absolute",
    left: -18,
    bottom: -28,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(236,251,255,0.10)",
  },

  heroGlowThird: {
    position: "absolute",
    right: 30,
    bottom: -16,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },

  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  heroTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#DFFFE8",
    fontSize: 11,
    fontFamily: FONT.bold,
    marginBottom: 12,
  },

  heroTitle: {
    fontFamily: FONT.bold,
    fontSize: 22,
    color: COLORS.white,
  },

  heroSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 19,
  },

  heroMiniWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: SPACING.md,
  },

  heroMiniPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroMiniText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: COLORS.white,
  },

  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    ...SHADOW.card,
  },

  summaryGrid: {
    gap: SPACING.sm,
  },

  summaryCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    ...SHADOW.card,
    borderWidth: 1,
  },

  summaryCardPrimary: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.12)",
  },

  summaryCardSuccess: {
    backgroundColor: "rgba(140,240,199,0.12)",
    borderColor: "rgba(255,255,255,0.12)",
  },

  summaryCardWarning: {
    backgroundColor: "rgba(255,204,102,0.12)",
    borderColor: "rgba(255,255,255,0.12)",
  },

  summaryCardInfo: {
    backgroundColor: "rgba(236,251,255,0.12)",
    borderColor: "rgba(255,255,255,0.12)",
  },

  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.72)",
    marginBottom: 6,
  },

  summaryValue: {
    fontFamily: FONT.bold,
    fontSize: 16,
  },

  summaryValuePrimary: {
    color: "#FFFFFF",
  },

  summaryValueSuccess: {
    color: "#FFFFFF",
  },

  summaryValueWarning: {
    color: "#FFFFFF",
  },

  summaryValueInfo: {
    color: "#FFFFFF",
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(220,53,69,0.18)",
  },

  errorText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  muted: {
    fontFamily: FONT.regular,
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    lineHeight: 18,
  },

  group: {
    gap: 12,
  },

  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  kLabel: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
  },

  kLabelStrong: {
    color: "#FFFFFF",
  },

  kValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "#FFFFFF",
  },

  kValueStrong: {
    fontFamily: FONT.bold,
  },

  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },

  listIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236,251,255,0.90)",
  },

  listTitle: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },

  listSub: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.72)",
  },

  listAmount: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: "#FFFFFF",
    textAlign: "right",
  },

  listMeta: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.72)",
    textAlign: "right",
  },

  smallBadge: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  noteBox: {
    padding: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  noteTitle: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: "#FFFFFF",
    marginBottom: 4,
  },

  noteText: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.84)",
    lineHeight: 18,
  },

  hintRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },

  hintText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 18,
  },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  pillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});