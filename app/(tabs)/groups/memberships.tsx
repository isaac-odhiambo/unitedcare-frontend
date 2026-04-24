import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import EmptyState from "@/components/ui/EmptyState";
import { ROUTES } from "@/constants/routes";
import { FONT, SPACING } from "@/constants/theme";

import {
  getApiErrorMessage,
  getGroup,
  listGroupMemberships,
} from "@/services/groups";

const PAGE_BG = "#062C49";
const CARD_BG = "rgba(255,255,255,0.08)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const WHITE = "#FFFFFF";
const SOFT_TEXT = "rgba(255,255,255,0.75)";

function roleLabel(role?: string) {
  const r = String(role || "").toUpperCase().trim();

  if (r === "ADMIN") return "Admin";
  if (r === "TREASURER") return "Treasurer";
  if (r === "SECRETARY") return "Secretary";

  return "Member";
}

function getNumericParam(value: unknown): number | null {
  if (Array.isArray(value)) {
    const first = value[0];
    const n = Number(first);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function GroupMembersScreen() {
  const params = useLocalSearchParams();

  const groupId = useMemo(() => {
    return (
      getNumericParam(params.groupId) ??
      getNumericParam(params.group_id) ??
      getNumericParam(params.id)
    );
  }, [params.groupId, params.group_id, params.id]);

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const goBack = useCallback(() => {
    if (groupId) {
      router.replace(ROUTES.dynamic.groupDetail(groupId) as any);
      return;
    }

    router.replace(ROUTES.tabs.groups as any);
  }, [groupId]);

  const load = useCallback(async () => {
    if (!groupId) {
      setGroup(null);
      setMembers([]);
      setLoading(false);
      setHasLoadedOnce(true);
      return;
    }

    try {
      setLoading(true);

      const [groupRes, membershipsRes] = await Promise.all([
        getGroup(groupId),
        listGroupMemberships(groupId),
      ]);

      setGroup(groupRes ?? null);
      setMembers(Array.isArray(membershipsRes) ? membershipsRes : []);
    } catch (e: any) {
      console.log("GROUP_MEMBERS_LOAD_ERROR", getApiErrorMessage(e));
      setGroup(null);
      setMembers([]);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        if (!active) return;
        await load();
      };

      run();

      return () => {
        active = false;
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (!hasLoadedOnce || loading) {
    return <SafeAreaView style={styles.safe} />;
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState
          icon="people-outline"
          title="Members not available"
          subtitle="Group could not be loaded."
          actionLabel="Back"
          onAction={goBack}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={18} color={WHITE} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Group Members</Text>
        <Text style={styles.subtitle}>{group.name || "Group"}</Text>

        {members.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No members"
            subtitle="This group has no members yet."
          />
        ) : (
          members.map((m, index) => (
            <View key={m?.id ?? `${m?.user_id ?? "member"}-${index}`} style={styles.card}>
              <View style={styles.row}>
                <Ionicons name="person-circle-outline" size={24} color={WHITE} />

                <View style={styles.memberTextWrap}>
                  <Text style={styles.name}>
                    {m?.user_name ||
                      m?.user?.name ||
                      m?.name ||
                      "Member"}
                  </Text>

                  <Text style={styles.role}>{roleLabel(m?.role)}</Text>
                </View>
              </View>

              <Text style={styles.status}>
                {m?.is_active ? "Active" : "Inactive"}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  content: {
    padding: SPACING.lg,
  },

  topBar: {
    marginBottom: SPACING.md,
  },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  backText: {
    color: WHITE,
    fontFamily: FONT.bold,
  },

  title: {
    color: WHITE,
    fontSize: 22,
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  subtitle: {
    color: SOFT_TEXT,
    marginBottom: SPACING.lg,
  },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },

  memberTextWrap: {
    marginLeft: 10,
    flex: 1,
  },

  name: {
    color: WHITE,
    fontFamily: FONT.bold,
  },

  role: {
    color: SOFT_TEXT,
    fontSize: 12,
    marginTop: 2,
  },

  status: {
    color: WHITE,
    fontSize: 12,
  },
});