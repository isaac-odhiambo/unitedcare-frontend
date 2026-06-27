// app/(tabs)/dashboard/index.tsx

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ROUTES } from "@/constants/routes";
import { SPACING } from "@/constants/theme";
import {
  getGroup,
  getGroupIdFromMembership,
  getGroupNameFromMembership,
  getMyGroupSavingsSummary,
  GroupMembership,
  listGroupMemberships,
} from "@/services/groups";
import {
  buildLoanRepaymentNarration,
  buildLoanRepaymentReference,
  getMyGuaranteeRequests,
  getMyLoans,
  Loan,
  LoanGuarantor,
} from "@/services/loans";
import {
  fmtKES,
  getMyAllMerryDueSummary,
  MyAllMerryDueSummaryResponse,
} from "@/services/merry";
import {
  canRequestLoan,
  getMe,
  isAdminUser,
  MeResponse,
} from "@/services/profile";
import { listMySavingsAccounts, SavingsAccount } from "@/services/savings";
import { getSessionUser, SessionUser } from "@/services/session";

type DashboardUser = Partial<MeResponse> &
  Partial<SessionUser> & {
    member_number?: string | number;
    full_name?: string;
    name?: string;
  };

type NoticeItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "primary" | "success" | "warning" | "info";
  actionLabel?: string;
  onPress?: () => void;
};

type ActionTone = "savings" | "merry" | "group" | "support";

function getGreetingByTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const n = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}

function formatKes(value: number): string {
  return `KES ${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function getSavingsTotal(accounts: SavingsAccount[]): number {
  return accounts.reduce((sum, account) => {
    const totalBalance = toNumber(account.balance ?? 0);
    if (totalBalance > 0) {
      return sum + totalBalance;
    }

    const available = toNumber(account.available_balance ?? 0);
    const reserved = toNumber((account as any)?.reserved_amount ?? 0);
    return sum + available + reserved;
  }, 0);
}

function getLoansTotal(loansData: Loan[]): number {
  const rows = Array.isArray(loansData) ? loansData : [];
  return rows.reduce((sum: number, loan: Loan) => {
    return sum + toNumber(loan?.outstanding_balance ?? 0);
  }, 0);
}

function getPrimarySavingsAccount(accounts: SavingsAccount[]) {
  if (!Array.isArray(accounts) || accounts.length === 0) return null;
  return accounts[0];
}

function getActiveLoan(loansData: Loan[]) {
  if (!Array.isArray(loansData) || loansData.length === 0) return null;

  return (
    loansData.find((loan) => {
      const status = String(loan?.status || "").toUpperCase();
      return ["APPROVED", "ACTIVE", "DISBURSED", "UNDER_REPAYMENT"].includes(
        status
      );
    }) || null
  );
}

function formatUserStatus(status?: string) {
  const value = String(status || "ACTIVE").replaceAll("_", " ").trim();
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getMemberIdentity(user: DashboardUser | null) {
  return (
    user?.full_name ||
    user?.name ||
    user?.username ||
    (typeof user?.phone === "string" ? user.phone : "") ||
    "Member"
  );
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "M";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function getDashboardUserId(user: DashboardUser | null): number {
  const candidates = [
    (user as any)?.id,
    (user as any)?.user_id,
    (user as any)?.pk,
  ];

  for (const value of candidates) {
    const id = toNumber(value);
    if (id > 0) return id;
  }

  return 0;
}

function buildSavingsDepositReference(userId: number): string {
  return userId > 0 ? `SAVING${userId}` : "";
}

function buildSavingsDepositNarration(userId: number): string {
  return userId > 0
    ? `Savings deposit for member ${userId}`
    : "Savings deposit";
}

function buildMerryContributionReference(userId: number): string {
  return userId > 0 ? `MUS${userId}` : "";
}

function buildMerryContributionNarration(
  userId: number,
  merryId?: number | null
): string {
  if (userId > 0 && merryId && merryId > 0) {
    return `Merry contribution for member ${userId} - merry ${merryId}`;
  }

  if (userId > 0) {
    return `Merry contribution for member ${userId}`;
  }

  return "Merry contribution";
}

function getGroupMeta(membership: any) {
  const group =
    membership?.group && typeof membership.group === "object"
      ? membership.group
      : null;

  const contributionAmount = toNumber(
    membership?.contribution_amount ??
      group?.contribution_amount ??
      membership?.monthly_contribution ??
      0
  );

  const requiresContributions = Boolean(
    membership?.requires_contributions ??
      group?.requires_contributions ??
      contributionAmount > 0
  );

  const paymentCode = String(
    membership?.payment_code ?? group?.payment_code ?? ""
  ).trim();

  return {
    contributionAmount,
    requiresContributions,
    paymentCode,
  };
}

function getGroupSummaryRow(rows: any[], groupId?: number | null) {
  if (!Array.isArray(rows) || !groupId) return null;

  return (
    rows.find((item: any) => {
      const id = item?.group?.id ?? item?.group_id ?? item?.group;
      return Number(id) === Number(groupId);
    }) || null
  );
}

function getGroupSummaryValue(summary: any, fallbackAmount: number) {
  const contributed = toNumber(summary?.my_share?.total_contributed ?? 0);
  if (contributed > 0) return formatKes(contributed);
  if (fallbackAmount > 0) return formatKes(fallbackAmount);
  return "Active";
}

function getGroupSummarySubtitle(summary: any, fallbackAmount: number) {
  const reserved = toNumber(summary?.my_share?.reserved_share ?? 0);
  const available = toNumber(summary?.my_share?.available_share ?? 0);

  if (fallbackAmount > 0) return `Contribution ${formatKes(fallbackAmount)}`;
  if (reserved > 0) return `Reserved ${formatKes(reserved)}`;
  if (available > 0) return `Available ${formatKes(available)}`;
  return "Active group";
}

function getMerryItemId(item: any): number {
  const candidates = [
    item?.merry_id,
    item?.merryId,
    item?.merryID,
    item?.merry_pk,
    item?.merry?.id,
    item?.merry?.pk,
    item?.merry?.merry_id,
    item?.merry?.merryId,
    item?.merry,
  ];

  for (const candidate of candidates) {
    const id = toNumber(candidate);
    if (id > 0) return id;
  }

  return 0;
}

function getMerryItemName(item: any, index: number): string {
  const name = String(
    item?.merry_name ??
      item?.merry?.name ??
      item?.name ??
      item?.title ??
      `Merry ${index + 1}`
  ).trim();

  return name || `Merry ${index + 1}`;
}

function getMerryItemDue(item: any): number {
  return (
    toNumber(item?.total_due_now) ||
    toNumber(item?.current_total) ||
    toNumber(item?.due_now) ||
    toNumber(item?.amount_due) ||
    toNumber(item?.next_total) ||
    0
  );
}

function getMerryItemMemberCount(item: any): number {
  return (
    toNumber(item?.member_count) ||
    toNumber(item?.members_count) ||
    toNumber(item?.total_members) ||
    toNumber(item?.merry?.member_count) ||
    toNumber(item?.merry?.members_count) ||
    0
  );
}

function getMerryStatusText(item: any): string {
  const due = getMerryItemDue(item);
  if (due > 0) return `Ready ${formatKes(due)}`;

  const activityValue =
    toNumber(item?.wallet_balance) ||
    toNumber(item?.total_wallet_balance) ||
    toNumber(item?.wallet?.balance);

  if (activityValue > 0) return `Active ${formatKes(activityValue)}`;

  const members = getMerryItemMemberCount(item);
  if (members > 0) return `${members} member${members === 1 ? "" : "s"}`;

  return "Active";
}

function getPrimaryMerryItem(summary: MyAllMerryDueSummaryResponse | null): any | null {
  const items = summary?.items ?? [];

  return (
    items.find((row: any) => getMerryItemDue(row) > 0 && getMerryItemId(row) > 0) ||
    items.find((row: any) => getMerryItemId(row) > 0) ||
    null
  );
}


function getActionPalette(tone: ActionTone) {
  const map = {
    savings: {
      card: "rgba(18, 184, 165, 0.18)",
      border: "rgba(216, 255, 248, 0.16)",
      iconBg: "#D8FFF8",
      icon: "#086B72",
      value: "#FFFFFF",
      muted: "rgba(255,255,255,0.78)",
      primaryBg: "#FFFFFF",
      primaryText: "#086B72",
      secondaryBg: "rgba(255,255,255,0.10)",
      secondaryText: "#D8FFF8",
    },
    merry: {
      card: "rgba(62, 183, 92, 0.18)",
      border: "rgba(221, 255, 226, 0.16)",
      iconBg: "#E5FFE8",
      icon: "#2C8744",
      value: "#FFFFFF",
      muted: "rgba(255,255,255,0.78)",
      primaryBg: "#FFFFFF",
      primaryText: "#2C8744",
      secondaryBg: "rgba(255,255,255,0.10)",
      secondaryText: "#E5FFE8",
    },
    group: {
      card: "rgba(41, 157, 210, 0.18)",
      border: "rgba(220, 246, 255, 0.16)",
      iconBg: "#DDF7FF",
      icon: "#096C8A",
      value: "#FFFFFF",
      muted: "rgba(255,255,255,0.78)",
      primaryBg: "#FFFFFF",
      primaryText: "#096C8A",
      secondaryBg: "rgba(255,255,255,0.10)",
      secondaryText: "#DDF7FF",
    },
    support: {
      card: "rgba(245, 158, 11, 0.17)",
      border: "rgba(255, 237, 190, 0.16)",
      iconBg: "#FFF0C2",
      icon: "#A46205",
      value: "#FFFFFF",
      muted: "rgba(255,255,255,0.78)",
      primaryBg: "#FFFFFF",
      primaryText: "#A46205",
      secondaryBg: "rgba(255,255,255,0.10)",
      secondaryText: "#FFF0C2",
    },
  };

  return map[tone];
}

async function clearDashboardSession() {
  const possibleKeys = [
    "access",
    "refresh",
    "access_token",
    "refresh_token",
    "ACCESS_TOKEN",
    "REFRESH_TOKEN",
    "user",
    "session_user",
    "SESSION_USER",
    "me",
  ];

  try {
    if (Platform.OS === "web") {
      possibleKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {}
      });
    } else {
      await Promise.allSettled(
        possibleKeys.map((key) => SecureStore.deleteItemAsync(key))
      );
    }
  } catch {}
}

function TopIconButton({
  icon,
  onPress,
  badgeCount = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badgeCount?: number;
}) {
  const label = badgeCount > 99 ? "99+" : String(badgeCount);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={styles.topIconBtn}
    >
      <Ionicons name={icon} size={19} color="#FFFFFF" />

      {badgeCount > 0 ? (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationBadgeText}>{label}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function ProfileMenuRow({
  title,
  icon,
  onPress,
  danger = false,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.profileMenuRow}
    >
      <View
        style={[
          styles.profileMenuIcon,
          danger ? styles.profileMenuIconDanger : null,
        ]}
      >
        <Ionicons
          name={icon}
          size={17}
          color={danger ? "#B42318" : "#0C6A80"}
        />
      </View>
      <Text
        style={[
          styles.profileMenuText,
          danger ? styles.profileMenuTextDanger : null,
        ]}
      >
        {title}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={15}
        color={danger ? "#B42318" : "#8A9AA6"}
      />
    </TouchableOpacity>
  );
}

function ProfileMenu({
  visible,
  memberName,
  memberNumber,
  status,
  isAdmin,
  loggingOut,
  onClose,
  onRefresh,
  onProfile,
  onPayments,
  onAdmin,
  onLogout,
}: {
  visible: boolean;
  memberName: string;
  memberNumber: string;
  status?: string;
  isAdmin: boolean;
  loggingOut: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onProfile: () => void;
  onPayments: () => void;
  onAdmin: () => void;
  onLogout: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.menuBackdrop} onPress={onClose} />

      <View style={styles.profileMenuCard}>
        <View style={styles.profileMenuHeader}>
          <View style={styles.profileMenuAvatar}>
            <Text style={styles.profileMenuAvatarText}>
              {getInitials(memberName)}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.profileMenuName}>
              {memberName}
            </Text>
            <Text numberOfLines={1} style={styles.profileMenuSub}>
              {memberNumber ? `Member #${memberNumber}` : formatUserStatus(status)}
            </Text>
          </View>
        </View>

        <ProfileMenuRow title="Profile" icon="person-outline" onPress={onProfile} />
        <ProfileMenuRow
          title="Contribution activity"
          icon="card-outline"
          onPress={onPayments}
        />
        <ProfileMenuRow
          title="Refresh dashboard"
          icon="refresh-outline"
          onPress={onRefresh}
        />

        {isAdmin ? (
          <ProfileMenuRow
            title="Admin tools"
            icon="shield-checkmark-outline"
            onPress={onAdmin}
          />
        ) : null}

        <View style={styles.profileMenuDivider} />

        <ProfileMenuRow
          title={loggingOut ? "Logging out..." : "Log out"}
          icon="log-out-outline"
          onPress={onLogout}
          danger
        />
      </View>
    </Modal>
  );
}

function ActionTile({
  title,
  subtitle,
  value,
  icon,
  tone,
  primaryLabel,
  secondaryLabel,
  message,
  primaryButtonBg,
  primaryButtonText,
  onPrimaryPress,
  onSecondaryPress,
}: {
  title: string;
  subtitle: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: ActionTone;
  primaryLabel: string;
  secondaryLabel?: string;
  message?: string;
  primaryButtonBg?: string;
  primaryButtonText?: string;
  onPrimaryPress: () => void;
  onSecondaryPress?: () => void;
}) {
  const palette = getActionPalette(tone);
  const primaryBg = primaryButtonBg || palette.primaryBg;
  const primaryTextColor = primaryButtonText || palette.primaryText;

  return (
    <View
      style={[
        styles.actionTile,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.actionOrbOne} />
      <View style={styles.actionOrbTwo} />

      <View style={styles.actionHeader}>
        <View style={[styles.actionIconWrap, { backgroundColor: palette.iconBg }]}>
          <Ionicons name={icon} size={21} color={palette.icon} />
        </View>

        <View style={styles.actionTitleWrap}>
          <Text numberOfLines={1} style={styles.actionTitle}>
            {title}
          </Text>
          <Text numberOfLines={2} style={[styles.actionSubtitle, { color: palette.muted }]}>
            {subtitle}
          </Text>
        </View>
      </View>

      <Text numberOfLines={1} style={[styles.actionValue, { color: palette.value }]}>
        {value}
      </Text>

      {message ? (
        <Text numberOfLines={2} style={styles.actionMessage}>
          {message}
        </Text>
      ) : null}

      <View style={styles.actionButtonRow}>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onPrimaryPress}
          style={[styles.actionPrimaryBtn, { backgroundColor: primaryBg }]}
        >
          <Text style={[styles.actionPrimaryText, { color: primaryTextColor }]}>
            {primaryLabel}
          </Text>
        </TouchableOpacity>

        {secondaryLabel && onSecondaryPress ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={onSecondaryPress}
            style={[
              styles.actionSecondaryBtn,
              {
                backgroundColor: palette.secondaryBg,
                borderColor: palette.border,
              },
            ]}
          >
            <Text
              style={[
                styles.actionSecondaryText,
                { color: palette.secondaryText },
              ]}
            >
              {secondaryLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function MerryFeatureCard({
  hasActiveMerry,
  merryItems,
  merryDueNow,
  merryAmountValue,
  merrySubtitle,
  onCardPress,
  onPrimaryPress,
  onItemPress,
  onItemContributePress,
}: {
  hasActiveMerry: boolean;
  merryItems: any[];
  merryDueNow: number;
  merryAmountValue: string;
  merrySubtitle: string;
  onCardPress: () => void;
  onPrimaryPress: () => void;
  onItemPress: (item: any) => void;
  onItemContributePress: (item: any) => void;
}) {
  const visibleItems = merryItems.slice(0, 6);
  const isDue = hasActiveMerry && merryDueNow > 0;

  const title = hasActiveMerry ? "Your merry spaces" : "Join a merry";
  const subtitle = hasActiveMerry
    ? visibleItems.length === 1
      ? "1 active merry space"
      : `${visibleItems.length} active merry spaces`
    : "Grow with members who contribute together.";
  const socialMessage = hasActiveMerry
    ? "Tap a merry name to open its details, or contribute directly from here."
    : "A merry helps members move together, one turn at a time.";

  return (
    <View style={styles.merryFeatureCard}>
      <View style={styles.merryOrbOne} />
      <View style={styles.merryOrbTwo} />

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onCardPress}
        style={styles.merryFeatureBody}
      >
        <View style={styles.merryFeatureHeader}>
          <View style={styles.merryIconWrap}>
            <Ionicons name="repeat-outline" size={25} color="#1E7A34" />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.merryFeatureTitle}>
              {title}
            </Text>
            <Text numberOfLines={2} style={styles.merryFeatureSubtitle}>
              {subtitle || merrySubtitle}
            </Text>
          </View>

          <View style={styles.merryStatusPill}>
            <Ionicons
              name={isDue ? "alert-circle-outline" : "checkmark-circle-outline"}
              size={14}
              color={isDue ? "#14532D" : "#DFFFE8"}
            />
            <Text
              style={[
                styles.merryStatusText,
                isDue ? styles.merryStatusTextDue : null,
              ]}
            >
              {isDue ? "Ready" : hasActiveMerry ? "Active" : "Open"}
            </Text>
          </View>
        </View>

        <Text numberOfLines={1} style={styles.merryFeatureValue}>
          {hasActiveMerry ? merryAmountValue : "Start together"}
        </Text>

        <Text numberOfLines={2} style={styles.merryFeatureMessage}>
          {socialMessage}
        </Text>
      </TouchableOpacity>

      {hasActiveMerry && visibleItems.length > 0 ? (
        <View style={styles.merryList}>
          {visibleItems.map((item: any, index: number) => {
            const id = getMerryItemId(item);
            const itemDue = getMerryItemDue(item);
            const isItemReady = itemDue > 0;

            return (
              <View
                key={`${id || "merry"}-${index}`}
                style={[
                  styles.merryListCard,
                  isItemReady ? styles.merryListCardReady : null,
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => onItemPress(item)}
                  style={styles.merryListMain}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.merryListTitle}>
                      {getMerryItemName(item, index)}
                    </Text>
                    <Text numberOfLines={1} style={styles.merryListSub}>
                      {getMerryStatusText(item)}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color="#E5FFE8" />
                </TouchableOpacity>

                <View style={styles.merryListActions}>
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={() => onItemPress(item)}
                    style={[styles.merryItemBtn, styles.merryItemBtnSoft]}
                  >
                    <Text style={styles.merryItemBtnSoftText}>Open</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={() => onItemContributePress(item)}
                    style={[styles.merryItemBtn, styles.merryItemBtnPrimary]}
                  >
                    <Text style={styles.merryItemBtnPrimaryText}>Contribute</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.merryButtonRow}>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onPrimaryPress}
          style={[
            styles.merryMainButton,
            isDue ? styles.merryPayButton : styles.merryOpenButton,
          ]}
        >
          <Ionicons
            name={isDue ? "arrow-forward-circle-outline" : hasActiveMerry ? "eye-outline" : "add-circle-outline"}
            size={16}
            color={isDue ? "#FFFFFF" : "#062C49"}
          />
          <Text
            style={[
              styles.merryMainButtonText,
              isDue ? styles.merryPayButtonText : null,
            ]}
          >
            {isDue ? "Contribute" : hasActiveMerry ? "View all" : "Join merry"}
          </Text>
        </TouchableOpacity>

        {hasActiveMerry ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={onCardPress}
            style={styles.merryDetailsButton}
          >
            <Text style={styles.merryDetailsButtonText}>All</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}


export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 760;

  const [user, setUser] = useState<DashboardUser | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
  const [heroSavings, setHeroSavings] = useState("—");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [guaranteeRequests, setGuaranteeRequests] = useState<LoanGuarantor[]>([]);
  const [merrySummary, setMerrySummary] =
    useState<MyAllMerryDueSummaryResponse | null>(null);
  const [groupMemberships, setGroupMemberships] = useState<GroupMembership[]>([]);
  const [groupSavingsSummaries, setGroupSavingsSummaries] = useState<any[]>([]);

  const isAdmin = isAdminUser(user as any);
  const loanAllowed = canRequestLoan(user as any);
  const memberUserId = useMemo(() => getDashboardUserId(user), [user]);

  const openMerryContributionFlow = useCallback((targetItem?: any | null) => {
    const fallbackItem = getPrimaryMerryItem(merrySummary);
    const payable = targetItem || fallbackItem;

    if (!payable) {
      router.push(ROUTES.tabs.merry as any);
      return;
    }

    const merryId = getMerryItemId(payable);

    if (merryId <= 0) {
      router.push(ROUTES.tabs.merry as any);
      return;
    }

    const amount = getMerryItemDue(payable);
    const merryName = getMerryItemName(payable, 0);

    const reference =
      String((payable as any)?.reference || "").trim() ||
      String((payable as any)?.merry?.reference || "").trim() ||
      buildMerryContributionReference(memberUserId);

    router.push({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: {
        title: `${merryName} Contribution`,
        source: "merry",
        purpose: "MERRY_CONTRIBUTION",
        reference,
        narration: buildMerryContributionNarration(memberUserId, merryId),
        merryId: String(merryId),
        amount: amount > 0 ? String(amount) : "",
        editableAmount: "true",
        returnTo: ROUTES.dynamic.merryDetail(merryId),
      },
    });
  }, [memberUserId, merrySummary]);

  const openFirstMerryFlow = useCallback(() => {
    openMerryContributionFlow();
  }, [openMerryContributionFlow]);


  const openMerryItemDetail = useCallback((item: any) => {
    const id = getMerryItemId(item);

    if (id > 0) {
      router.push({
        pathname: "/(tabs)/merry/[id]" as any,
        params: {
          id: String(id),
          returnTo: ROUTES.tabs.dashboard,
          backLabel: "Back to Dashboard",
          landingTitle: "Dashboard",
        },
      });
      return;
    }

    router.push(ROUTES.tabs.merry as any);
  }, []);

  const openSavingsFlow = useCallback(
    (account?: SavingsAccount | null) => {
      if (!account) {
        router.push(ROUTES.tabs.savings as any);
        return;
      }

      const reference = buildSavingsDepositReference(memberUserId);

      router.replace({
        pathname: "/(tabs)/payments/deposit" as any,
        params: {
          title: "Contribution",
          source: "savings",
          purpose: "SAVINGS_DEPOSIT",
          reference,
          narration: buildSavingsDepositNarration(memberUserId),
          savingsId: String(account.id),
          amount: "",
          editableAmount: "true",
        },
      });
    },
    [memberUserId]
  );

  const openLoanPaymentFlow = useCallback((loan?: Loan | null) => {
    if (!loan) {
      router.push(ROUTES.tabs.loans as any);
      return;
    }

    const borrowerUserId =
      toNumber((loan as any)?.borrower_user_id) ||
      toNumber((loan as any)?.borrower?.id) ||
      toNumber((loan as any)?.user_id) ||
      toNumber((loan as any)?.user?.id) ||
      toNumber((loan as any)?.borrower);

    if (!borrowerUserId) {
      router.push({
        pathname: "/(tabs)/loans/[id]" as any,
        params: { id: String(loan.id) },
      });
      return;
    }

    const outstandingAmount = toNumber((loan as any)?.outstanding_balance);
    const suggestedAmount =
      toNumber((loan as any)?.amount_due) ||
      toNumber((loan as any)?.installment_amount) ||
      toNumber((loan as any)?.weekly_installment) ||
      outstandingAmount;

    router.replace({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: {
        title: "Support Contribution",
        source: "loan",
        purpose: "LOAN_REPAYMENT",
        loanId: String(loan.id),
        borrowerUserId: String(borrowerUserId),
        reference: buildLoanRepaymentReference(borrowerUserId),
        narration: buildLoanRepaymentNarration({
          borrowerUserId,
          loanId: toNumber((loan as any)?.id),
        }),
        amount: suggestedAmount > 0 ? String(suggestedAmount) : "",
        editableAmount: "true",
        returnTo: ROUTES.dynamic.loanDetail(toNumber((loan as any)?.id)),
      },
    });
  }, []);

  const openDirectGroupPaymentFlow = useCallback(async (groupItem?: any | null) => {
    const groupId = Number(groupItem?.id ?? 0);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      router.push(ROUTES.tabs.groups as any);
      return;
    }

    try {
      const loadedGroup = await getGroup(groupId);

      const groupName = String(
        (loadedGroup as any)?.name || groupItem?.name || "Community group"
      ).trim();
      const rawPaymentCode = (loadedGroup as any)?.payment_code;
      const groupCode = String(rawPaymentCode || "").trim().toUpperCase();

      if (!groupCode) {
        throw new Error("Missing group payment code.");
      }

      const memberships = await listGroupMemberships();

      const membership = Array.isArray(memberships)
        ? memberships.find((item: any) => {
            const membershipGroupId = Number(getGroupIdFromMembership(item));
            return membershipGroupId === groupId && !!item?.is_active;
          })
        : null;

      const targetUserId =
        toNumber((membership as any)?.user_id) ||
        toNumber((membership as any)?.user?.id) ||
        toNumber((membership as any)?.member_user_id);

      if (targetUserId <= 0) {
        throw new Error("Missing member user id.");
      }

      const finalReference = `${groupCode}${targetUserId}`;
      const narration = groupName
        ? `${groupName} contribution`
        : "Community contribution";

      const amount = toNumber(
        groupItem?.contributionAmount ??
          (loadedGroup as any)?.contribution_amount ??
          0
      );

      router.push({
        pathname: ROUTES.tabs.paymentsDeposit as any,
        params: {
          title: groupName || "Group Contribution",
          source: "group",
          purpose: "GROUP_CONTRIBUTION",
          reference: finalReference,
          groupCode,
          groupName,
          userId: String(targetUserId),
          narration,
          amount: amount > 0 ? String(amount) : "",
          groupId: String(groupId),
          editableAmount: "true",
          returnTo: ROUTES.dynamic.groupDetail(groupId),
        },
      });
    } catch {
      router.push(ROUTES.tabs.groupsMemberships as any);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [
        sessionResult,
        meResult,
        savingsResult,
        loansResult,
        merrySummaryResult,
        guaranteeResult,
        membershipsResult,
        groupSavingsSummaryResult,
      ] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        listMySavingsAccounts(),
        getMyLoans(),
        getMyAllMerryDueSummary(),
        getMyGuaranteeRequests(),
        listGroupMemberships(),
        getMyGroupSavingsSummary(),
      ]);

      const sessionUser =
        sessionResult.status === "fulfilled" ? sessionResult.value : null;
      const meUser = meResult.status === "fulfilled" ? meResult.value : null;

      const mergedUser: DashboardUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      const savings =
        savingsResult.status === "fulfilled" ? savingsResult.value : [];
      setSavingsAccounts(savings);
      setHeroSavings(formatKes(getSavingsTotal(savings)));

      setLoans(loansResult.status === "fulfilled" ? loansResult.value : []);
      setGuaranteeRequests(
        guaranteeResult.status === "fulfilled" ? guaranteeResult.value : []
      );
      setMerrySummary(
        merrySummaryResult.status === "fulfilled"
          ? merrySummaryResult.value
          : null
      );
      setGroupMemberships(
        membershipsResult.status === "fulfilled" &&
          Array.isArray(membershipsResult.value)
          ? membershipsResult.value
          : []
      );
      setGroupSavingsSummaries(
        groupSavingsSummaryResult.status === "fulfilled" &&
          Array.isArray(groupSavingsSummaryResult.value)
          ? groupSavingsSummaryResult.value
          : []
      );
    } finally {
      setHasBootstrapped(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
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

  const handleLogout = useCallback(() => {
    Alert.alert("Log out", "Do you want to leave your account for now?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            setLoggingOut(true);
            await clearDashboardSession();
            router.replace(ROUTES.auth.login as any);
          } finally {
            setLoggingOut(false);
            setProfileMenuOpen(false);
          }
        },
      },
    ]);
  }, []);

  const memberName = useMemo(() => getMemberIdentity(user), [user]);
  const greetingText = useMemo(() => getGreetingByTime(), []);
  const totalOutstandingLoans = useMemo(() => getLoansTotal(loans), [loans]);
  const primarySavingsAccount = useMemo(
    () => getPrimarySavingsAccount(savingsAccounts),
    [savingsAccounts]
  );
  const activeLoan = useMemo(() => getActiveLoan(loans), [loans]);

  const activeGroupMemberships = useMemo(
    () => groupMemberships.filter((m: any) => !!m?.is_active),
    [groupMemberships]
  );

  const selectedDashboardGroup = useMemo(() => {
    const first = activeGroupMemberships[0];
    if (!first) return null;

    const id = Number(getGroupIdFromMembership(first));
    if (!Number.isFinite(id) || id <= 0) return null;

    const name = getGroupNameFromMembership(first) || "Community group";
    const meta = getGroupMeta(first);
    const summary = getGroupSummaryRow(groupSavingsSummaries, id);

    return {
      id,
      name,
      userId:
        toNumber((first as any)?.user_id) ||
        toNumber((first as any)?.user?.id) ||
        toNumber((first as any)?.member_user_id),
      contributionAmount: meta.contributionAmount,
      paymentCode: meta.paymentCode,
      requiresContributions: meta.requiresContributions,
      summaryValue: getGroupSummaryValue(summary, meta.contributionAmount),
      subtitle: getGroupSummarySubtitle(summary, meta.contributionAmount),
    };
  }, [activeGroupMemberships, groupSavingsSummaries]);

  const activeContributionGroups = useMemo(() => {
    return activeGroupMemberships
      .map((membership: any) => {
        const id = Number(getGroupIdFromMembership(membership));
        const name = getGroupNameFromMembership(membership) || "Community group";
        const meta = getGroupMeta(membership);
        const summary = getGroupSummaryRow(groupSavingsSummaries, id);

        return {
          id,
          name,
          userId:
            toNumber((membership as any)?.user_id) ||
            toNumber((membership as any)?.user?.id) ||
            toNumber((membership as any)?.member_user_id),
          contributionAmount: meta.contributionAmount,
          paymentCode: meta.paymentCode,
          requiresContributions: meta.requiresContributions,
          summaryValue: getGroupSummaryValue(summary, meta.contributionAmount),
          subtitle: getGroupSummarySubtitle(summary, meta.contributionAmount),
        };
      })
      .filter((item) => item.id > 0 && item.requiresContributions);
  }, [activeGroupMemberships, groupSavingsSummaries]);

  const firstActiveContributionGroup = useMemo(() => {
    return activeContributionGroups[0] ?? null;
  }, [activeContributionGroups]);

  const dashboardGroupForAction = useMemo(() => {
    return firstActiveContributionGroup || selectedDashboardGroup;
  }, [firstActiveContributionGroup, selectedDashboardGroup]);

  const memberNumber = useMemo(() => {
    const raw = user?.member_number;
    if (raw === undefined || raw === null || raw === "") return "";
    return String(raw);
  }, [user]);

  const merryDueNow = useMemo(
    () => toNumber(merrySummary?.total_due_now),
    [merrySummary]
  );

  const merryWalletBalance = useMemo(() => {
    const raw =
      (merrySummary as any)?.wallet_balance ??
      (merrySummary as any)?.total_wallet_balance ??
      0;
    return toNumber(raw);
  }, [merrySummary]);

  const merryItems = useMemo(() => merrySummary?.items ?? [], [merrySummary]);

  const hasActiveMerry = useMemo(() => {
    return merryItems.length > 0;
  }, [merryItems]);

  const merryAmountValue = useMemo(() => {
    if (merryWalletBalance > 0 && merryDueNow <= 0) {
      return formatKes(merryWalletBalance);
    }

    if (merryDueNow > 0) {
      return fmtKES(merrySummary?.total_due_now);
    }

    return "Active";
  }, [merryWalletBalance, merryDueNow, merrySummary]);

  const merrySubtitle = useMemo(() => {
    if (merryDueNow > 0) return "Contribution due";
    if (merryWalletBalance > 0) return "Merry activity";
    return "Open merry";
  }, [merryDueNow, merryWalletBalance]);

  const hasActiveGroups = activeGroupMemberships.length > 0;

  const communityCount = useMemo(() => {
    const merryCount = hasActiveMerry ? 1 : 0;
    const savingsCount = savingsAccounts.length > 0 ? 1 : 0;
    const groupCount = hasActiveGroups ? 1 : 0;
    const supportCount = activeLoan ? 1 : 0;
    return merryCount + savingsCount + groupCount + supportCount;
  }, [hasActiveMerry, savingsAccounts.length, hasActiveGroups, activeLoan]);

  const noticeItems = useMemo<NoticeItem[]>(() => {
    const items: NoticeItem[] = [];

    if (hasActiveMerry && merryDueNow > 0) {
      items.push({
        id: "merry-due",
        title: "Merry contribution waiting",
        subtitle: `${fmtKES(merrySummary?.total_due_now)} is ready for contribution.`,
        icon: "repeat-outline",
        tone: "success",
        actionLabel: "Contribute",
        onPress: openFirstMerryFlow,
      });
    }

    if (guaranteeRequests.length > 0) {
      items.push({
        id: "guarantee-requests",
        title:
          guaranteeRequests.length === 1
            ? "1 support request waiting"
            : `${guaranteeRequests.length} support requests waiting`,
        subtitle: "Review and respond.",
        icon: "people-outline",
        tone: "primary",
        actionLabel: "View",
        onPress: () => router.push("/(tabs)/loans/guarantee-requests" as any),
      });
    }

    const approvedLoan = loans.find(
      (l) => String(l.status || "").toUpperCase() === "APPROVED"
    );

    if (approvedLoan) {
      items.push({
        id: "support-ready",
        title: "Support ready",
        subtitle: "Your support request is ready to view.",
        icon: "checkmark-circle-outline",
        tone: "success",
        actionLabel: "Open",
        onPress: () =>
          router.push({
            pathname: "/(tabs)/loans/[id]" as any,
            params: { id: String(approvedLoan.id) },
          }),
      });
    }

    return items.slice(0, 9);
  }, [
    guaranteeRequests.length,
    hasActiveMerry,
    loans,
    merryDueNow,
    merrySummary,
    openFirstMerryFlow,
  ]);

  const unreadNotificationCount = noticeItems.length;

  if (!hasBootstrapped) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <ScrollView
          style={styles.page}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.backgroundBlobTop} />
          <View style={styles.backgroundBlobMiddle} />

          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.logo}
                resizeMode="contain"
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.brandWordmark}>
                  UNITED <Text style={styles.brandWordmarkGreen}>CARE</Text>
                </Text>
                <Text style={styles.brandSub}>Member dashboard</Text>
              </View>
            </View>

            <View style={styles.topBarActions}>
              <View style={styles.bootTopIcon} />
              <View style={styles.bootAvatar} />
            </View>
          </View>

          <View style={styles.bootHeroCard}>
            <View style={[styles.bootLine, styles.bootLineMedium]} />
            <View style={[styles.bootLine, styles.bootLineLong]} />
          </View>

          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={[styles.actionGrid, isWideScreen && styles.actionGridWide]}>
            {[0, 1, 2, 3].map((item) => (
              <View
                key={item}
                style={[styles.actionGridItem, isWideScreen && styles.actionGridItemWide]}
              >
                <View style={styles.bootActionCard}>
                  <View style={styles.bootCardTop}>
                    <View style={styles.bootCircle} />
                    <View style={{ flex: 1 }}>
                      <View style={[styles.bootLine, styles.bootLineShort]} />
                      <View style={[styles.bootLine, styles.bootLineMedium]} />
                    </View>
                  </View>
                  <View style={[styles.bootLine, styles.bootLineMedium]} />
                  <View style={styles.bootButtonLine} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Not signed in</Text>
          <Text style={styles.emptySubtitle}>Please log in to continue.</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.replace(ROUTES.auth.login as any)}
          >
            <Text style={styles.emptyButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <View style={styles.root}>
        <ScrollView
          style={styles.page}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8CF0C7"
              colors={["#8CF0C7", "#0CC0B7"]}
            />
          }
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.backgroundBlobTop} />
          <View style={styles.backgroundBlobMiddle} />

          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.logo}
                resizeMode="contain"
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.brandWordmark}>
                  UNITED <Text style={styles.brandWordmarkGreen}>CARE</Text>
                </Text>
                <Text style={styles.brandSub}>Member dashboard</Text>
              </View>
            </View>

            <View style={styles.topBarActions}>
              <TopIconButton
                icon="notifications-outline"
                badgeCount={unreadNotificationCount}
                onPress={() => router.push("/(tabs)/notifications" as any)}
              />

              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => setProfileMenuOpen(true)}
                style={styles.profileButton}
              >
                <Text style={styles.profileButtonText}>{getInitials(memberName)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroOrbOne} />
            <View style={styles.heroOrbTwo} />

            <View style={styles.heroContentRow}>
              <View style={styles.heroTextWrap}>
                <Text numberOfLines={1} style={styles.heroTitle}>
                  {greetingText}, {memberName}
                </Text>
                <Text numberOfLines={1} style={styles.heroCaption}>
                  Stay connected with your merry, groups and support.
                </Text>
              </View>

              <View style={styles.heroStatusStack}>
                <View style={styles.heroPill}>
                  <Ionicons name="ellipse" size={7} color="#DFFFE8" />
                  <Text style={styles.heroPillText}>{formatUserStatus(user?.status)}</Text>
                </View>

                {memberNumber ? (
                  <View style={styles.heroPill}>
                    <Ionicons name="card-outline" size={13} color="#FFFFFF" />
                    <Text style={styles.heroPillText}>#{memberNumber}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.heroSavingsCard}>
              <View style={styles.heroSavingsTextWrap}>
                <Text style={styles.heroSavingsLabel}>Savings total</Text>
                <Text numberOfLines={1} style={styles.heroSavingsValue}>
                  {heroSavings}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => openSavingsFlow(primarySavingsAccount)}
                style={styles.heroSaveButton}
              >
                <Ionicons name="add-circle-outline" size={15} color="#062C49" />
                <Text style={styles.heroSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroBottomRow}>
              <Text style={styles.heroSmallText}>
                {communityCount} active area{communityCount === 1 ? "" : "s"}
              </Text>

              {unreadNotificationCount > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push("/(tabs)/notifications" as any)}
                  style={styles.heroNoticeChip}
                >
                  <Ionicons name="notifications-outline" size={13} color="#062C49" />
                  <Text style={styles.heroNoticeText}>
                    {unreadNotificationCount} unread
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <Text style={styles.sectionTitle}>Merry circle</Text>

          <MerryFeatureCard
            hasActiveMerry={hasActiveMerry}
            merryItems={merryItems}
            merryDueNow={merryDueNow}
            merryAmountValue={merryAmountValue}
            merrySubtitle={merrySubtitle}
            onCardPress={() => router.push(ROUTES.tabs.merry as any)}
            onPrimaryPress={
              hasActiveMerry && merryDueNow > 0
                ? openFirstMerryFlow
                : () => router.push(ROUTES.tabs.merry as any)
            }
            onItemPress={openMerryItemDetail}
            onItemContributePress={openMerryContributionFlow}
          />

          <Text style={styles.sectionTitle}>Community actions</Text>

          <View style={[styles.actionGrid, isWideScreen && styles.actionGridWide]}>
            <View
              style={[
                styles.actionGridItem,
                isWideScreen && styles.actionGridItemWideThree,
              ]}
            >
              <ActionTile
                title="Contribution Club"
                subtitle={
                  savingsAccounts.length > 0
                    ? "Keep your community record active."
                    : "Start your contribution space."
                }
                message={
                  savingsAccounts.length > 0
                    ? "Small entries keep your space active."
                    : "Create your contribution space and begin when ready."
                }
                value={heroSavings}
                icon="layers-outline"
                tone="savings"
                primaryLabel={savingsAccounts.length > 0 ? "Contribute" : "Start"}
                secondaryLabel={savingsAccounts.length > 0 ? "Open" : undefined}
                onPrimaryPress={() => openSavingsFlow(primarySavingsAccount)}
                onSecondaryPress={
                  savingsAccounts.length > 0
                    ? () => router.push(ROUTES.tabs.savings as any)
                    : undefined
                }
              />
            </View>

            <View
              style={[
                styles.actionGridItem,
                isWideScreen && styles.actionGridItemWideThree,
              ]}
            >
              <ActionTile
                title={dashboardGroupForAction?.name || "Groups"}
                subtitle={
                  dashboardGroupForAction?.subtitle ||
                  (hasActiveGroups ? "Open active group." : "Find your group.")
                }
                message={
                  hasActiveGroups
                    ? "Stay close to members and contribute on time."
                    : "Join a group and grow with your community."
                }
                value={
                  dashboardGroupForAction?.summaryValue ||
                  (hasActiveGroups
                    ? `${activeGroupMemberships.length} active`
                    : "Explore")
                }
                icon="people-outline"
                tone="group"
                primaryLabel={hasActiveGroups ? "Contribute" : "Explore"}
                secondaryLabel={hasActiveGroups ? "View" : undefined}
                onPrimaryPress={() =>
                  dashboardGroupForAction
                    ? openDirectGroupPaymentFlow(dashboardGroupForAction)
                    : hasActiveGroups
                    ? router.push(ROUTES.tabs.groupsMemberships as any)
                    : router.push(ROUTES.tabs.groups as any)
                }
                onSecondaryPress={
                  hasActiveGroups
                    ? () =>
                        dashboardGroupForAction?.id
                          ? router.push(ROUTES.dynamic.groupDetail(dashboardGroupForAction.id) as any)
                          : router.push(ROUTES.tabs.groupsMemberships as any)
                    : undefined
                }
              />
            </View>

            <View
              style={[
                styles.actionGridItem,
                isWideScreen && styles.actionGridItemWideThree,
              ]}
            >
              <ActionTile
                title="Support"
                subtitle={
                  activeLoan
                    ? "Active support record."
                    : loanAllowed
                    ? "Need support? Apply here."
                    : "Check your support access."
                }
                message={
                  activeLoan
                    ? "Continue steadily and keep your record strong."
                    : loanAllowed
                    ? "Apply when you need support and get sorted."
                    : "Build your profile to unlock more support."
                }
                value={activeLoan ? formatKes(totalOutstandingLoans) : "Open"}
                icon="heart-outline"
                tone="support"
                primaryLabel={
                  activeLoan
                    ? "Continue"
                    : loanAllowed
                    ? "Request"
                    : "Check"
                }
                secondaryLabel={activeLoan ? "View" : undefined}
                onPrimaryPress={() => {
                  if (activeLoan) {
                    openLoanPaymentFlow(activeLoan);
                    return;
                  }

                  router.push(
                    loanAllowed ? (ROUTES.tabs.loans as any) : (ROUTES.tabs.profile as any)
                  );
                }}
                onSecondaryPress={
                  activeLoan
                    ? () =>
                        router.push({
                          pathname: "/(tabs)/loans/[id]" as any,
                          params: { id: String(activeLoan.id) },
                        })
                    : undefined
                }
              />
            </View>
          </View>

          <View style={{ height: 12 }} />
        </ScrollView>

        <ProfileMenu
          visible={profileMenuOpen}
          memberName={memberName}
          memberNumber={memberNumber}
          status={user?.status}
          isAdmin={isAdmin}
          loggingOut={loggingOut}
          onClose={() => setProfileMenuOpen(false)}
          onRefresh={() => {
            setProfileMenuOpen(false);
            onRefresh();
          }}
          onProfile={() => {
            setProfileMenuOpen(false);
            router.push(ROUTES.tabs.profile as any);
          }}
          onPayments={() => {
            setProfileMenuOpen(false);
            router.push(ROUTES.tabs.payments as any);
          }}
          onAdmin={() => {
            setProfileMenuOpen(false);
            router.push(ROUTES.tabs.groups as any);
          }}
          onLogout={handleLogout}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#062C49",
  },

  root: {
    flex: 1,
    backgroundColor: "#062C49",
  },

  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    position: "relative",
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -76,
    right: -42,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(19, 195, 178, 0.10)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 250,
    left: -90,
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: "rgba(52, 174, 213, 0.08)",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: 10,
    paddingTop: SPACING.xs,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },

  logo: {
    width: 64,
    height: 42,
  },

  brandWordmark: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  brandWordmarkGreen: {
    color: "#74D16C",
  },

  brandSub: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 11,
    marginTop: 1,
  },

  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  topIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F04438",
    borderWidth: 1,
    borderColor: "#062C49",
  },

  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },

  profileButtonText: {
    color: "#0C6A80",
    fontSize: 13,
    fontWeight: "900",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(12,106,128,0.44)",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(176, 243, 234, 0.12)",
  },

  heroOrbOne: {
    position: "absolute",
    right: -42,
    top: -36,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(38, 208, 214, 0.16)",
  },

  heroOrbTwo: {
    position: "absolute",
    left: -34,
    bottom: -48,
    width: 150,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(102, 212, 109, 0.14)",
  },

  heroContentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900",
  },

  heroCaption: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
    fontWeight: "600",
  },

  heroStatusStack: {
    alignItems: "flex-end",
    gap: 6,
  },

  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  heroPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  heroSavingsCard: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  heroSavingsTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  heroSavingsLabel: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 11,
    fontWeight: "800",
  },

  heroSavingsValue: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 21,
    marginTop: 2,
    fontWeight: "900",
  },

  heroSaveButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#DFFFE8",
  },

  heroSaveButtonText: {
    color: "#062C49",
    fontSize: 12,
    fontWeight: "900",
  },

  heroBottomRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },

  heroSmallText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontWeight: "700",
  },

  heroNoticeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#DFFFE8",
  },

  heroNoticeText: {
    color: "#062C49",
    fontSize: 11,
    fontWeight: "900",
  },

  merryFeatureCard: {
    position: "relative",
    overflow: "hidden",
    minHeight: 238,
    borderRadius: 26,
    padding: 14,
    marginBottom: 16,
    backgroundColor: "rgba(62, 183, 92, 0.20)",
    borderWidth: 1,
    borderColor: "rgba(221, 255, 226, 0.18)",
  },

  merryOrbOne: {
    position: "absolute",
    right: -50,
    top: -44,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(216, 255, 232, 0.11)",
  },

  merryOrbTwo: {
    position: "absolute",
    left: -44,
    bottom: -56,
    width: 170,
    height: 130,
    borderRadius: 999,
    backgroundColor: "rgba(38, 208, 214, 0.10)",
  },

  merryFeatureBody: {
    flex: 1,
  },

  merryFeatureHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  merryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5FFE8",
  },

  merryFeatureTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },

  merryFeatureSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    fontWeight: "700",
  },

  merryStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  merryStatusText: {
    color: "#DFFFE8",
    fontSize: 11,
    fontWeight: "900",
  },

  merryStatusTextDue: {
    color: "#FFFFFF",
  },

  merryFeatureValue: {
    color: "#FFFFFF",
    fontSize: 26,
    lineHeight: 33,
    fontWeight: "900",
    marginTop: 16,
  },

  merryFeatureMessage: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: "700",
  },

  merryTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 13,
  },

  merryTab: {
    minWidth: 112,
    flexGrow: 1,
    flexBasis: "46%",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
  },

  merryTabDue: {
    backgroundColor: "rgba(62, 183, 92, 0.24)",
    borderColor: "rgba(216, 255, 226, 0.24)",
  },

  merryTabTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  merryTabSub: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 10,
    marginTop: 3,
    fontWeight: "700",
  },

  merryList: {
    gap: 10,
    marginTop: 14,
  },

  merryListCard: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.11)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },

  merryListCardReady: {
    backgroundColor: "rgba(62, 183, 92, 0.26)",
    borderColor: "rgba(216, 255, 226, 0.28)",
  },

  merryListMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  merryListTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  merryListSub: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "700",
  },

  merryListActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 11,
  },

  merryItemBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  merryItemBtnSoft: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  merryItemBtnPrimary: {
    backgroundColor: "#FFFFFF",
  },

  merryItemBtnSoftText: {
    color: "#E5FFE8",
    fontSize: 12,
    fontWeight: "900",
  },

  merryItemBtnPrimaryText: {
    color: "#1E7A34",
    fontSize: 12,
    fontWeight: "900",
  },

  merryButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 14,
  },

  merryMainButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12,
  },

  merryPayButton: {
    backgroundColor: "#3EB75C",
  },

  merryOpenButton: {
    backgroundColor: "#FFFFFF",
  },

  merryMainButtonText: {
    color: "#062C49",
    fontSize: 13,
    fontWeight: "900",
  },

  merryPayButtonText: {
    color: "#FFFFFF",
  },

  merryDetailsButton: {
    minHeight: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    backgroundColor: "rgba(255,255,255,0.11)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },

  merryDetailsButtonText: {
    color: "#E5FFE8",
    fontSize: 13,
    fontWeight: "900",
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
    marginTop: 0,
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },

  actionGridWide: {
    marginHorizontal: -7,
  },

  actionGridItem: {
    width: "50%",
    paddingHorizontal: 5,
    marginBottom: 10,
  },

  actionGridItemWide: {
    width: "25%",
    paddingHorizontal: 7,
  },

  actionGridItemWideThree: {
    width: "33.333%",
    paddingHorizontal: 7,
  },

  actionTile: {
    minHeight: 154,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    overflow: "hidden",
  },

  actionOrbOne: {
    position: "absolute",
    top: -30,
    right: -28,
    width: 104,
    height: 104,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  actionOrbTwo: {
    position: "absolute",
    bottom: -42,
    left: -24,
    width: 120,
    height: 90,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  actionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  actionTitleWrap: {
    flex: 1,
    minWidth: 0,
  },

  actionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  actionSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    fontWeight: "700",
  },

  actionValue: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: "900",
  },

  actionMessage: {
    color: "rgba(255,255,255,0.73)",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
    marginBottom: 8,
    fontWeight: "700",
  },

  actionButtonRow: {
    marginTop: "auto",
    flexDirection: "row",
    gap: 7,
  },

  actionPrimaryBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  actionPrimaryText: {
    fontSize: 12,
    fontWeight: "900",
  },

  actionSecondaryBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
  },

  actionSecondaryText: {
    fontSize: 12,
    fontWeight: "900",
  },

  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },

  profileMenuCard: {
    position: "absolute",
    top: 74,
    right: 14,
    width: 270,
    borderRadius: 22,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(6,44,73,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },

  profileMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    marginBottom: 4,
  },

  profileMenuAvatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C6A80",
  },

  profileMenuAvatarText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  profileMenuName: {
    color: "#102A3A",
    fontSize: 14,
    fontWeight: "900",
  },

  profileMenuSub: {
    color: "#667985",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },

  profileMenuRow: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  profileMenuIcon: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12,106,128,0.10)",
  },

  profileMenuIconDanger: {
    backgroundColor: "rgba(180,35,24,0.10)",
  },

  profileMenuText: {
    flex: 1,
    color: "#173041",
    fontSize: 13,
    fontWeight: "800",
  },

  profileMenuTextDanger: {
    color: "#B42318",
  },

  profileMenuDivider: {
    height: 1,
    marginVertical: 6,
    backgroundColor: "rgba(16,42,58,0.08)",
  },

  bootTopIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  bootAvatar: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  bootHeroCard: {
    minHeight: 84,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    justifyContent: "center",
  },

  bootActionCard: {
    minHeight: 154,
    borderRadius: 20,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    justifyContent: "space-between",
  },

  bootCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  bootCircle: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  bootLine: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginTop: 7,
  },

  bootLineShort: {
    width: "52%",
  },

  bootLineMedium: {
    width: "72%",
  },

  bootLineLong: {
    width: "90%",
  },

  bootButtonLine: {
    height: 36,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#062C49",
  },

  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },

  emptySubtitle: {
    color: "rgba(255,255,255,0.75)",
    marginTop: 8,
    textAlign: "center",
  },

  emptyButton: {
    marginTop: 16,
    backgroundColor: "#0C6A80",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});