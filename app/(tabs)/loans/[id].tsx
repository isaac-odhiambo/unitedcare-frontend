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
      bg: "rgba(46, 125, 50, 0.12)",
      color: COLORS.success,
    };
  }

  if (s === "COMPLETED") {
    return {
      bg: "rgba(37, 99, 235, 0.12)",
      color: COLORS.primary,
    };
  }

  if (s === "REJECTED" || s === "DEFAULTED" || s === "CANCELLED") {
    return {
      bg: "rgba(211, 47, 47, 0.12)",
      color: COLORS.danger,
    };
  }

  if (s === "UNDER_REVIEW") {
    return {
      bg: "rgba(37, 99, 235, 0.12)",
      color: COLORS.info,
    };
  }

  return {
    bg: "rgba(242, 140, 40, 0.14)",
    color: COLORS.accent,
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
      <Text style={[styles.kLabel, strong && { color: COLORS.dark }]}>
        {label}
      </Text>
      <Text style={[styles.kValue, strong && { fontFamily: FONT.bold }]}>
        {value}
      </Text>
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
        highlight: false,
        tone: "primary",
        icon: "heart-outline" as const,
      },
      {
        label: "Balance remaining",
        value: formatKes(loan?.outstanding_balance ?? "0.00"),
        highlight: true,
        tone: "warning",
        icon: "wallet-outline" as const,
      },
      {
        label: "Amount settled",
        value: formatKes(loan?.total_paid ?? "0.00"),
        highlight: false,
        tone: "success",
        icon: "checkmark-circle-outline" as const,
      },
      {
        label: "Repayment period",
        value: loan?.term_weeks ? `${loan.term_weeks} week(s)` : "—",
        highlight: false,
        tone: "info",
        icon: "calendar-outline" as const,
      },
    ];
  }, [loan]);

  if (loading && !loan) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!Number.isFinite(loanId) || loanId <= 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={[styles.center, { backgroundColor: COLORS.background }]}>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />

          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="heart-outline" size={20} color={COLORS.white} />
            </View>

            {loan?.status ? <StatusPill status={loan.status} /> : null}
          </View>

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
              color={COLORS.danger}
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
                  ? "rgba(46, 125, 50, 0.12)"
                  : item.tone === "warning"
                  ? "rgba(242, 140, 40, 0.14)"
                  : item.tone === "info"
                  ? "rgba(37, 99, 235, 0.12)"
                  : "rgba(37, 99, 235, 0.12)";

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
                        { color: g.accepted ? COLORS.success : COLORS.accent },
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
              color={COLORS.gray}
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
    backgroundColor: COLORS.background,
  },

  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  center: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: "center",
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
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
    backgroundColor: "rgba(242, 140, 40, 0.18)",
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
    backgroundColor: COLORS.white,
    borderColor: "rgba(37, 99, 235, 0.10)",
  },

  summaryCardSuccess: {
    backgroundColor: "rgba(46, 125, 50, 0.05)",
    borderColor: "rgba(46, 125, 50, 0.12)",
  },

  summaryCardWarning: {
    backgroundColor: "rgba(242, 140, 40, 0.06)",
    borderColor: "rgba(242, 140, 40, 0.14)",
  },

  summaryCardInfo: {
    backgroundColor: "rgba(37, 99, 235, 0.05)",
    borderColor: "rgba(37, 99, 235, 0.12)",
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
    color: COLORS.gray,
    marginBottom: 6,
  },

  summaryValue: {
    fontFamily: FONT.bold,
    fontSize: 16,
  },

  summaryValuePrimary: {
    color: COLORS.primary,
  },

  summaryValueSuccess: {
    color: COLORS.success,
  },

  summaryValueWarning: {
    color: COLORS.accent,
  },

  summaryValueInfo: {
    color: COLORS.info,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  muted: {
    fontFamily: FONT.regular,
    color: COLORS.gray,
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
    color: COLORS.gray,
  },

  kValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.dark,
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
    backgroundColor: COLORS.background,
  },

  listTitle: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.dark,
  },

  listSub: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
  },

  listAmount: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
    textAlign: "right",
  },

  listMeta: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
    textAlign: "right",
  },

  smallBadge: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  noteBox: {
    padding: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  noteTitle: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
    marginBottom: 4,
  },

  noteText: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
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
    color: COLORS.gray,
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