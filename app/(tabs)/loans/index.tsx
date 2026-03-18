// app/(tabs)/loans/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  getApiErrorMessage,
  getLoanEligibilityPreview,
  getMyGuaranteeRequests,
  getMyLoans,
  Loan,
  LoanEligibilityPreview,
  LoanGuarantor,
} from "@/services/loans";
import {
  canRequestLoan,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import {
  getSessionUser,
  saveSessionUser,
  SessionUser,
} from "@/services/session";

type LoanUser = Partial<MeResponse> & Partial<SessionUser>;

const SURFACE = "#F4F6F8";
const SURFACE_2 = "#EEF2F6";
const SURFACE_3 = "#E8EDF3";
const BORDER = "#D9E1EA";
const CARD_BORDER = "rgba(15, 23, 42, 0.06)";
const TEXT_MAIN = "#0F172A";
const TEXT_SOFT = "#334155";
const TEXT_MUTED = "#64748B";

function toNum(x?: string | number | null) {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtKES(amount?: string | number | null) {
  const n = toNum(amount);
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatDisplayName(user?: LoanUser | null) {
  if (!user) return "Member";
  return (
    (user as any)?.full_name ||
    (user as any)?.name ||
    user?.username ||
    (typeof user?.phone === "string" ? user.phone : "") ||
    "Member"
  );
}

function formatStatus(user?: LoanUser | null) {
  return String((user as any)?.status || "ACTIVE").replaceAll("_", " ");
}

function statusColor(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
      return COLORS.success;
    case "COMPLETED":
      return COLORS.primary;
    case "PENDING":
    case "UNDER_REVIEW":
      return COLORS.warning;
    case "DEFAULTED":
    case "REJECTED":
    case "CANCELLED":
      return COLORS.danger;
    default:
      return COLORS.gray;
  }
}

function statusText(status?: string | null) {
  if (!status) return "—";
  return String(status).replaceAll("_", " ");
}

function getPrimaryLoan(loans: Loan[]) {
  if (!loans.length) return null;

  const active = loans.find((loan) =>
    ["PENDING", "UNDER_REVIEW", "APPROVED", "DEFAULTED"].includes(
      String(loan.status).toUpperCase()
    )
  );

  return active || loans[0];
}

function getOtherLoans(loans: Loan[], primaryLoanId?: number | null) {
  return loans.filter((loan) => loan.id !== primaryLoanId);
}

function getLoanProductName(loan?: Loan | null) {
  if (!loan) return "Assigned loan product";
  return loan.product_detail?.name || loan.product_name || "Assigned loan product";
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

function SmallAction({
  title,
  icon,
  onPress,
  tone,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone: string;
}) {
  return (
    <Card onPress={onPress} style={styles.smallActionCard} variant="default">
      <View style={[styles.smallActionIconWrap, { backgroundColor: `${tone}18` }]}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>
      <Text style={styles.smallActionText}>{title}</Text>
    </Card>
  );
}

export default function LoansIndexScreen() {
  const [user, setUser] = useState<LoanUser | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [guaranteeRequests, setGuaranteeRequests] = useState<LoanGuarantor[]>([]);
  const [eligibility, setEligibility] = useState<LoanEligibilityPreview | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const loanAllowed = canRequestLoan(user);

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, loansRes, guaranteesRes, eligibilityRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          getMyLoans(),
          getMyGuaranteeRequests(),
          getLoanEligibilityPreview(),
        ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: LoanUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      if (mergedUser) {
        await saveSessionUser(mergedUser);
      }

      setLoans(
        loansRes.status === "fulfilled" && Array.isArray(loansRes.value)
          ? loansRes.value
          : []
      );

      setGuaranteeRequests(
        guaranteesRes.status === "fulfilled" && Array.isArray(guaranteesRes.value)
          ? guaranteesRes.value
          : []
      );

      setEligibility(
        eligibilityRes.status === "fulfilled" ? eligibilityRes.value ?? null : null
      );

      let nextError = "";

      if (meRes.status === "rejected") {
        nextError =
          getApiErrorMessage(meRes.reason) || getErrorMessage(meRes.reason);
      } else if (loansRes.status === "rejected") {
        nextError =
          getApiErrorMessage(loansRes.reason) || getErrorMessage(loansRes.reason);
      } else if (guaranteesRes.status === "rejected") {
        nextError =
          getApiErrorMessage(guaranteesRes.reason) ||
          getErrorMessage(guaranteesRes.reason);
      } else if (eligibilityRes.status === "rejected") {
        nextError =
          getApiErrorMessage(eligibilityRes.reason) ||
          getErrorMessage(eligibilityRes.reason);
      }

      setError(nextError);
    } catch (e: any) {
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        try {
          setLoading(true);
          await load();
        } finally {
          setLoading(false);
        }
      };

      run();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const displayName = useMemo(() => formatDisplayName(user), [user]);
  const memberStatus = useMemo(() => formatStatus(user), [user]);

  const primaryLoan = useMemo(() => getPrimaryLoan(loans), [loans]);
  const otherLoans = useMemo(
    () => getOtherLoans(loans, primaryLoan?.id ?? null),
    [loans, primaryLoan]
  );

  const pendingGuarantees = useMemo(
    () => guaranteeRequests.filter((item) => !item.accepted).length,
    [guaranteeRequests]
  );

  const acceptedGuarantees = useMemo(
    () => guaranteeRequests.filter((item) => item.accepted).length,
    [guaranteeRequests]
  );

  const eligibilityView = useMemo(() => {
    const availableSavings = toNum(eligibility?.available_savings);
    const maxAllowed = toNum(eligibility?.max_allowed);
    const outstanding = primaryLoan ? toNum(primaryLoan.outstanding_balance) : 0;
    const securityReserved = primaryLoan
      ? toNum(primaryLoan.security_reserved_total)
      : 0;

    const hasActiveLoan =
      Boolean(eligibility?.has_active_loan) ||
      Boolean(
        primaryLoan &&
          ["PENDING", "UNDER_REVIEW", "APPROVED", "DEFAULTED"].includes(
            String(primaryLoan.status).toUpperCase()
          )
      );

    let title = "Eligibility unavailable";
    let subtitle = "Loan position could not be calculated.";
    let tone = COLORS.warning;
    let minAllowed = 0;
    let allowedNow = maxAllowed;

    if (!kycComplete) {
      title = "Complete KYC first";
      subtitle = "Profile verification is required before a new request.";
      tone = COLORS.warning;
      allowedNow = 0;
    } else if (hasActiveLoan && outstanding > 0) {
      title = `Outstanding ${fmtKES(outstanding)}`;
      subtitle = "Clear or reduce the current loan before another request.";
      tone = COLORS.warning;
      allowedNow = 0;
    } else if (eligibility?.eligible && maxAllowed > 0) {
      title = `Eligible up to ${fmtKES(maxAllowed)}`;
      subtitle = "Enter an amount within the approved range.";
      tone = COLORS.success;
      minAllowed = 1;
    } else if (eligibility?.reason) {
      title = "Not eligible yet";
      subtitle = eligibility.reason;
      tone = COLORS.warning;
      allowedNow = 0;
    } else {
      title = "Not ready yet";
      subtitle = "Improve savings or support position before requesting.";
      tone = COLORS.warning;
      allowedNow = 0;
    }

    return {
      title,
      subtitle,
      tone,
      availableSavings,
      maxAllowed,
      minAllowed,
      allowedNow,
      outstanding,
      securityReserved,
      hasActiveLoan,
      canApply:
        kycComplete &&
        !hasActiveLoan &&
        Boolean(eligibility?.eligible) &&
        maxAllowed > 0,
    };
  }, [eligibility, primaryLoan, kycComplete]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to access loans."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login as any)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <View style={styles.heroTop}>
          <View style={{ flex: 1, paddingRight: SPACING.md }}>
            <Text style={styles.heroEyebrow}>
              {isAdmin ? "ADMIN LOAN OVERVIEW" : "LOAN OVERVIEW"}
            </Text>
            <Text style={styles.heroTitle}>{displayName}</Text>
            <Text style={styles.heroSubtitle}>
              {eligibilityView.allowedNow > 0
                ? `Allowed range ${fmtKES(eligibilityView.minAllowed)} - ${fmtKES(
                    eligibilityView.allowedNow
                  )}`
                : memberStatus}
            </Text>
          </View>

          <View style={styles.heroAvatar}>
            <Ionicons name="cash-outline" size={24} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.heroFooter}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>{memberStatus}</Text>
          </View>

          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {kycComplete ? "KYC Complete" : "KYC Pending"}
            </Text>
          </View>

          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {primaryLoan ? "Primary loan available" : "No active loan"}
            </Text>
          </View>
        </View>
      </View>

      {error ? (
        <Card style={styles.errorCard} variant="default">
          <View style={styles.errorIcon}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.danger}
            />
          </View>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Section
        title="Eligibility"
        subtitle="Calculated from your current loan and support position."
      >
        <Card style={styles.eligibilityCard} variant="default">
          <View style={styles.eligibilityTop}>
            <View
              style={[
                styles.eligibilityIconWrap,
                { backgroundColor: `${eligibilityView.tone}18` },
              ]}
            >
              <Ionicons
                name={
                  eligibilityView.tone === COLORS.success
                    ? "checkmark-circle-outline"
                    : "calculator-outline"
                }
                size={22}
                color={eligibilityView.tone}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.eligibilityTitle}>{eligibilityView.title}</Text>
              <Text style={styles.eligibilitySubtitle}>
                {eligibilityView.subtitle}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <InfoRow label="Applicant" value={displayName} />
          <InfoRow
            label="Allowed range"
            value={
              eligibilityView.allowedNow > 0
                ? `${fmtKES(eligibilityView.minAllowed)} - ${fmtKES(
                    eligibilityView.allowedNow
                  )}`
                : "Not available now"
            }
            valueColor={
              eligibilityView.allowedNow > 0 ? COLORS.success : COLORS.warning
            }
          />
          <InfoRow
            label="Available savings support"
            value={fmtKES(eligibilityView.availableSavings)}
          />
          <InfoRow
            label="Outstanding balance"
            value={fmtKES(eligibilityView.outstanding)}
            valueColor={
              eligibilityView.outstanding > 0 ? COLORS.warning : COLORS.success
            }
          />
          <InfoRow
            label="Reserved security"
            value={fmtKES(eligibilityView.securityReserved)}
            valueColor={
              eligibilityView.securityReserved > 0 ? COLORS.info : TEXT_MAIN
            }
          />

          <View style={{ marginTop: SPACING.md }}>
            <Button
              title={
                eligibilityView.canApply
                  ? "Continue to Loan Request"
                  : "Complete Requirement First"
              }
              onPress={() =>
                eligibilityView.canApply
                  ? router.push(ROUTES.tabs.loansRequest as any)
                  : router.push(ROUTES.tabs.profileKyc as any)
              }
              leftIcon={
                <Ionicons
                  name={
                    eligibilityView.canApply
                      ? "arrow-forward-outline"
                      : "shield-outline"
                  }
                  size={18}
                  color={COLORS.white}
                />
              }
            />
          </View>
        </Card>
      </Section>

      {primaryLoan ? (
        <Section
          title="Primary Loan"
          subtitle="Your most relevant loan appears first."
        >
          <Card style={styles.primaryLoanCard} variant="default">
            <View style={styles.primaryLoanTop}>
              <View style={styles.primaryLoanIconWrap}>
                <Ionicons
                  name="receipt-outline"
                  size={22}
                  color={COLORS.primary}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.primaryLoanTitle}>
                  Loan #{primaryLoan.id}
                </Text>
                <Text style={styles.primaryLoanSubtitle}>
                  {getLoanProductName(primaryLoan)}
                </Text>
              </View>

              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: `${statusColor(primaryLoan.status)}18` },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    { color: statusColor(primaryLoan.status) },
                  ]}
                >
                  {statusText(primaryLoan.status).toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <InfoRow label="Principal" value={fmtKES(primaryLoan.principal)} />
            <InfoRow
              label="Total payable"
              value={
                toNum(primaryLoan.total_payable) > 0
                  ? fmtKES(primaryLoan.total_payable)
                  : "Pending approval"
              }
            />
            <InfoRow
              label="Paid so far"
              value={fmtKES(primaryLoan.total_paid)}
              valueColor={
                toNum(primaryLoan.total_paid) > 0 ? COLORS.success : TEXT_MAIN
              }
            />
            <InfoRow
              label="Outstanding"
              value={fmtKES(primaryLoan.outstanding_balance)}
              valueColor={
                toNum(primaryLoan.outstanding_balance) > 0
                  ? COLORS.warning
                  : COLORS.success
              }
            />
            <InfoRow
              label="Security target"
              value={fmtKES(primaryLoan.security_target)}
              valueColor={
                toNum(primaryLoan.security_target) > 0 ? COLORS.info : TEXT_MAIN
              }
            />
            <InfoRow
              label="Security reserved"
              value={fmtKES(primaryLoan.security_reserved_total)}
              valueColor={
                toNum(primaryLoan.security_reserved_total) > 0
                  ? COLORS.info
                  : TEXT_MAIN
              }
            />
            <InfoRow label="Created" value={fmtDate(primaryLoan.created_at)} />

            <View style={{ marginTop: SPACING.md }}>
              <Button
                title="Open Loan Details"
                variant="secondary"
                onPress={() =>
                  router.push(
                    ROUTES.dynamic.loanDetail(primaryLoan.id) as any
                  )
                }
              />
            </View>
          </Card>
        </Section>
      ) : null}

      <Section
        title="More"
        subtitle="Open other loan tools only when needed."
      >
        <View style={styles.smallActionsGrid}>
          <SmallAction
            title="Guarantor Requests"
            icon="people-outline"
            tone={COLORS.success}
            onPress={() => router.push(ROUTES.tabs.loansGuarantees as any)}
          />

          <SmallAction
            title="Current Loan"
            icon="document-text-outline"
            tone={COLORS.warning}
            onPress={() =>
              primaryLoan
                ? router.push(ROUTES.dynamic.loanDetail(primaryLoan.id) as any)
                : router.push(ROUTES.tabs.loansRequest as any)
            }
          />

          <SmallAction
            title="Application"
            icon="create-outline"
            tone={COLORS.info}
            onPress={() =>
              eligibilityView.canApply
                ? router.push(ROUTES.tabs.loansRequest as any)
                : router.push(ROUTES.tabs.profileKyc as any)
            }
          />

          <SmallAction
            title="Summary"
            icon="stats-chart-outline"
            tone={COLORS.primary}
            onPress={() => {}}
          />
        </View>
      </Section>

      {otherLoans.length > 0 ? (
        <Section
          title="Other Loans"
          subtitle="Shown only because you have more than one loan record."
        >
          <Card style={styles.summaryCard} variant="default">
            <InfoRow label="Other loans" value={String(otherLoans.length)} />
            <InfoRow
              label="Combined outstanding"
              value={fmtKES(
                otherLoans.reduce(
                  (sum, loan) => sum + toNum(loan.outstanding_balance),
                  0
                )
              )}
              valueColor={COLORS.warning}
            />
            <InfoRow
              label="Combined paid"
              value={fmtKES(
                otherLoans.reduce((sum, loan) => sum + toNum(loan.total_paid), 0)
              )}
              valueColor={COLORS.success}
            />
          </Card>
        </Section>
      ) : null}

      <Section
        title="Loan Summary"
        subtitle="A quick combined view across your loan profile."
      >
        <Card style={styles.summaryCard} variant="default">
          <InfoRow label="Total loans" value={String(loans.length)} />
          <InfoRow
            label="Pending guarantor requests"
            value={String(pendingGuarantees)}
            valueColor={pendingGuarantees > 0 ? COLORS.warning : TEXT_MAIN}
          />
          <InfoRow
            label="Accepted guarantor requests"
            value={String(acceptedGuarantees)}
            valueColor={acceptedGuarantees > 0 ? COLORS.success : TEXT_MAIN}
          />
          <InfoRow
            label="Total outstanding"
            value={fmtKES(
              loans.reduce((sum, loan) => sum + toNum(loan.outstanding_balance), 0)
            )}
            valueColor={COLORS.warning}
          />
        </Card>
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    overflow: "hidden",
    ...SHADOW.strong,
  },

  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -60,
    right: -40,
  },

  heroGlowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: -30,
    left: -20,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  heroEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 1,
  },

  heroTitle: {
    marginTop: 6,
    color: COLORS.white,
    fontFamily: FONT.bold,
    fontSize: 24,
    lineHeight: 30,
  },

  heroSubtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.86)",
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
  },

  heroAvatar: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },

  heroFooter: {
    marginTop: SPACING.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },

  heroPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroPillText: {
    color: COLORS.white,
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  errorCard: {
    backgroundColor: "#FFF4F4",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  errorIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.10)",
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  eligibilityCard: {
    backgroundColor: SURFACE,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  eligibilityTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  eligibilityIconWrap: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },

  eligibilityTitle: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 17,
    lineHeight: 23,
  },

  eligibilitySubtitle: {
    marginTop: 5,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  primaryLoanCard: {
    backgroundColor: SURFACE,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  primaryLoanTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  primaryLoanIconWrap: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.primary}16`,
  },

  primaryLoanTitle: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 17,
  },

  primaryLoanSubtitle: {
    marginTop: 5,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },

  statusPillText: {
    fontFamily: FONT.bold,
    fontSize: 10,
    letterSpacing: 0.3,
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: SPACING.md,
  },

  infoRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  infoLabel: {
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 12,
  },

  applyCard: {
    backgroundColor: SURFACE_2,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  applyTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  applyIconWrap: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.primary}16`,
  },

  applyTitle: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 17,
  },

  applySubtitle: {
    marginTop: 5,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  smallActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
  },

  smallActionCard: {
    width: "48.5%",
    backgroundColor: SURFACE,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: 72,
  },

  smallActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },

  smallActionText: {
    flex: 1,
    color: TEXT_SOFT,
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  summaryCard: {
    backgroundColor: SURFACE_3,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
});