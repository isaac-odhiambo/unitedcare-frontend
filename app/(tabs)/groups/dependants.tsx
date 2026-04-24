import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import EmptyState from "@/components/ui/EmptyState";
import { ROUTES } from "@/constants/routes";
import { FONT, SPACING } from "@/constants/theme";

import {
  addGroupDependant,
  getApiErrorMessage,
  getGroup,
  Group,
  GroupDependant,
  listGroupDependants,
  listGroupMemberships,
} from "@/services/groups";

const PAGE_BG = "#062C49";
const CARD_BG = "rgba(255,255,255,0.08)";
const CARD_BG_STRONG = "rgba(255,255,255,0.12)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const WHITE = "#FFFFFF";
const SOFT_TEXT = "rgba(255,255,255,0.75)";
const SOFT_TEXT_2 = "rgba(255,255,255,0.84)";

const RELATIONSHIP_OPTIONS = [
  "CHILD",
  "SPOUSE",
  "PARENT",
  "SIBLING",
  "OTHER",
];

function groupSupportsDependants(group?: Group | null) {
  const type = String(group?.group_type || "").toUpperCase().trim();
  return type === "WELFARE" || type === "BURIAL";
}

function getGroupTypeLabel(group?: Group | null) {
  if (!group) return "Community space";
  return group.group_type_display || group.group_type || "Community space";
}

function getRelationshipLabel(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "OTHER";
  return raw.replaceAll("_", " ");
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function GlassButton({
  title,
  onPress,
  disabled,
  primary = false,
  leftIcon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  leftIcon?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.buttonBase,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      {leftIcon ? <View style={styles.buttonIcon}>{leftIcon}</View> : null}
      <Text
        style={[
          styles.buttonText,
          primary ? styles.buttonTextPrimary : styles.buttonTextSecondary,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function RelationshipDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => setOpen((prev) => !prev)}
        style={styles.dropdownTrigger}
      >
        <Text style={styles.dropdownText}>{getRelationshipLabel(value)}</Text>
        <Ionicons
          name={open ? "chevron-up-outline" : "chevron-down-outline"}
          size={18}
          color={WHITE}
        />
      </TouchableOpacity>

      {open ? (
        <View style={styles.dropdownMenu}>
          {RELATIONSHIP_OPTIONS.map((option) => {
            const active = option === value;
            return (
              <TouchableOpacity
                key={option}
                activeOpacity={0.9}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
                style={[styles.dropdownItem, active && styles.dropdownItemActive]}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    active && styles.dropdownItemTextActive,
                  ]}
                >
                  {getRelationshipLabel(option)}
                </Text>
                {active ? (
                  <Ionicons
                    name="checkmark-outline"
                    size={16}
                    color="#0C6A80"
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function DependantCard({
  dependant,
}: {
  dependant: GroupDependant;
}) {
  return (
    <View style={styles.linkCard}>
      <View style={styles.savedTopRow}>
        <View style={styles.linkIconWrap}>
          <Ionicons name="people-outline" size={18} color="#0C6A80" />
        </View>

        <View style={styles.savedTextWrap}>
          <Text style={styles.linkCardTitle}>{dependant.name}</Text>
          <Text style={styles.cardSubText}>
            {dependant.relationship_display ||
              getRelationshipLabel(dependant.relationship)}
          </Text>
        </View>

        <View
          style={[
            styles.savedStatusPill,
            dependant.is_active
              ? styles.savedStatusActive
              : styles.savedStatusInactive,
          ]}
        >
          <Text style={styles.savedStatusText}>
            {dependant.is_active ? "Active" : "Inactive"}
          </Text>
        </View>
      </View>

      <Text style={styles.savedMetaText}>
        Date of birth:{" "}
        {dependant.date_of_birth ? formatDate(dependant.date_of_birth) : "—"}
      </Text>

      {!!dependant.note ? (
        <Text style={styles.noteText}>{dependant.note}</Text>
      ) : null}

      <View style={styles.lockedNotice}>
        <Ionicons name="lock-closed-outline" size={14} color={WHITE} />
        <Text style={styles.lockedNoticeText}>
          This record is locked. Contact group admin for corrections.
        </Text>
      </View>
    </View>
  );
}

export default function GroupDependantsScreen() {
  const params = useLocalSearchParams();
  const groupId = Number(params.groupId ?? params.group_id ?? params.id);

  const [group, setGroup] = useState<Group | null>(null);
  const [membershipId, setMembershipId] = useState<number | null>(null);
  const [dependants, setDependants] = useState<GroupDependant[]>([]);

  const [loading, setLoading] = useState(true);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("CHILD");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [note, setNote] = useState("");

  const goBackToGroup = useCallback(() => {
    if (Number.isFinite(groupId)) {
      router.replace(ROUTES.dynamic.groupDetail(groupId) as any);
      return;
    }
    router.replace(ROUTES.tabs.groups as any);
  }, [groupId]);

  const resetForm = useCallback(() => {
    setName("");
    setRelationship("CHILD");
    setDateOfBirth("");
    setNote("");
  }, []);

  const load = useCallback(async () => {
    try {
      if (!Number.isFinite(groupId)) {
        return;
      }

      const [groupRes, membershipsRes] = await Promise.all([
        getGroup(groupId),
        listGroupMemberships(),
      ]);

      const safeMemberships = Array.isArray(membershipsRes) ? membershipsRes : [];

      const myMembership =
        safeMemberships.find((m: any) => {
          const id =
            m?.group_id ??
            (typeof m?.group === "number" ? m.group : m?.group?.id);

          return Number(id) === groupId && !!m?.is_active;
        }) || null;

      setGroup(groupRes);
      setMembershipId(myMembership?.id ?? null);

      if (!myMembership?.id) {
        setDependants([]);
        return;
      }

      try {
        const dependantsRes = await listGroupDependants({ group_id: groupId });
        const safeDependants = Array.isArray(dependantsRes) ? dependantsRes : [];
        setDependants(safeDependants);
      } catch (e: any) {
        console.log("DEPENDANTS LIST RAW ERROR", e);
        console.log("DEPENDANTS LIST MESSAGE", e?.message);
        console.log("DEPENDANTS LIST CODE", e?.code);
        console.log("DEPENDANTS LIST STATUS", e?.response?.status);
        console.log("DEPENDANTS LIST DATA", e?.response?.data);
        setDependants([]);
        Alert.alert("Dependants", getApiErrorMessage(e));
      }
    } catch (e: any) {
      console.log("DEPENDANTS LOAD RAW ERROR", e);
      console.log("DEPENDANTS LOAD MESSAGE", e?.message);
      console.log("DEPENDANTS LOAD CODE", e?.code);
      console.log("DEPENDANTS LOAD STATUS", e?.response?.status);
      console.log("DEPENDANTS LOAD DATA", e?.response?.data);
      Alert.alert("Dependants", getApiErrorMessage(e));
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const run = async () => {
        if (!mounted) return;
        setLoading(true);
        await load();
        if (mounted) {
          setLoading(false);
          setHasBootstrapped(true);
        }
      };

      run();

      return () => {
        mounted = false;
      };
    }, [load])
  );

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const canManageDependants = useMemo(() => {
    return !!membershipId && groupSupportsDependants(group);
  }, [membershipId, group]);

  const handleSave = async () => {
    try {
      if (!membershipId) {
        Alert.alert(
          "Dependants",
          "Your membership must be approved before adding dependants."
        );
        return;
      }

      if (!groupSupportsDependants(group)) {
        Alert.alert(
          "Dependants",
          "Dependants are only available for welfare or burial groups."
        );
        return;
      }

      if (!name.trim()) {
        Alert.alert("Dependants", "Please enter dependant name.");
        return;
      }

      if (!relationship.trim()) {
        Alert.alert("Dependants", "Please select relationship.");
        return;
      }

      Alert.alert(
        "Confirm dependant",
        "Dependants are used for bereavement support and reference. Once saved, this record will be locked and cannot be edited directly.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: async () => {
              try {
                setSaving(true);

                await addGroupDependant({
                  membership: membershipId,
                  name: name.trim(),
                  relationship: relationship.trim().toUpperCase(),
                  date_of_birth: dateOfBirth.trim() || undefined,
                  note: note.trim() || undefined,
                });

                Alert.alert("Dependants", "Dependant added successfully.");
                resetForm();
                await load();
              } catch (e: any) {
                console.log("DEPENDANTS SAVE RAW ERROR", e);
                console.log("DEPENDANTS SAVE MESSAGE", e?.message);
                console.log("DEPENDANTS SAVE CODE", e?.code);
                console.log("DEPENDANTS SAVE STATUS", e?.response?.status);
                console.log("DEPENDANTS SAVE DATA", e?.response?.data);
                Alert.alert("Dependants", getApiErrorMessage(e));
              } finally {
                setSaving(false);
              }
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Dependants", getApiErrorMessage(e));
    }
  };

  if (!Number.isFinite(groupId)) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerWrap}>
          <EmptyState
            icon="people-outline"
            title="Dependants not available"
            subtitle="Invalid group selected."
            actionLabel="Back to group"
            onAction={goBackToGroup}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!loading && hasBootstrapped && !group) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerWrap}>
          <EmptyState
            icon="people-outline"
            title="Dependants not available"
            subtitle="This group could not be opened."
            actionLabel="Back to group"
            onAction={goBackToGroup}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.container}
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
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={goBackToGroup}
            style={styles.backPill}
          >
            <Ionicons name="arrow-back-outline" size={16} color={WHITE} />
            <Text style={styles.backPillText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={onRefresh}
            style={styles.iconBtn}
          >
            <Ionicons name="refresh-outline" size={18} color={WHITE} />
          </TouchableOpacity>
        </View>

        {!hasBootstrapped || loading ? (
          <View style={styles.inlineLoader}>
            <Ionicons name="sync-outline" size={18} color="#8CF0C7" />
          </View>
        ) : null}

        {!!group ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroGlowPrimary} />
              <View style={styles.heroGlowAccent} />

              <View style={styles.heroTopRow}>
                <View style={styles.heroIconWrap}>
                  <Ionicons name="people-circle-outline" size={18} color={WHITE} />
                </View>

                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: canManageDependants
                        ? "rgba(140,240,199,0.18)"
                        : "rgba(255,204,102,0.18)",
                    },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {canManageDependants ? "ACTIVE" : "RESTRICTED"}
                  </Text>
                </View>
              </View>

              <Text style={styles.title}>Dependants</Text>
              <Text style={styles.sub}>
                {group.name} • {getGroupTypeLabel(group)}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Important</Text>
              <Text style={styles.infoDescription}>
                Dependants are used for bereavement support and family reference.
                After saving, records are locked for security and fraud prevention.
                Contact group admin if a correction is needed.
              </Text>
            </View>

            {!canManageDependants ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Dependants unavailable</Text>
                <Text style={styles.infoDescription}>
                  Dependants are only for approved welfare or burial memberships.
                </Text>
              </View>
            ) : (
              <>
                <SectionTitle title="Add dependant" />

                <View style={styles.formCard}>
                  <View style={styles.inputWrap}>
                    <Text style={styles.inputLabel}>Full name</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Enter dependant full name"
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.inputWrap}>
                    <Text style={styles.inputLabel}>Relationship</Text>
                    <RelationshipDropdown
                      value={relationship}
                      onChange={setRelationship}
                    />
                  </View>

                  <View style={styles.inputWrap}>
                    <Text style={styles.inputLabel}>Date of birth</Text>
                    <TextInput
                      value={dateOfBirth}
                      onChangeText={setDateOfBirth}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.inputWrap}>
                    <Text style={styles.inputLabel}>Note</Text>
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      placeholder="Optional note"
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      multiline
                      style={[styles.input, styles.textArea]}
                    />
                  </View>

                  <GlassButton
                    title={saving ? "Please wait..." : "Add dependant"}
                    onPress={handleSave}
                    disabled={saving}
                    primary
                  />
                </View>

                <SectionTitle title="Saved dependants" />

                {dependants.length === 0 ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>No dependants yet</Text>
                    <Text style={styles.infoDescription}>
                      Add your first dependant here.
                    </Text>
                  </View>
                ) : (
                  dependants.map((item) => (
                    <DependantCard
                      key={item.id}
                      dependant={item}
                    />
                  ))
                )}
              </>
            )}
          </>
        ) : null}

        <View style={styles.bottomActions}>
          <GlassButton title="Back to Group" onPress={goBackToGroup} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 16,
  },

  centerWrap: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.lg,
    backgroundColor: PAGE_BG,
  },

  inlineLoader: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 260,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -120,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 140,
    right: 18,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(12,192,183,0.08)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 160,
    left: 8,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(140,240,199,0.06)",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
    paddingTop: SPACING.xs,
  },

  backPill: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: CARD_BG_STRONG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  backPillText: {
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.bold,
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD_BG_STRONG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: CARD_BG,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 22,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  heroGlowPrimary: {
    position: "absolute",
    right: -28,
    top: -24,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroGlowAccent: {
    position: "absolute",
    left: -20,
    bottom: -26,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(236,251,255,0.08)",
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  heroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusText: {
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  title: {
    color: WHITE,
    fontSize: 20,
    fontFamily: FONT.bold,
  },

  sub: {
    color: SOFT_TEXT_2,
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.medium,
  },

  sectionTitle: {
    fontSize: 18,
    color: WHITE,
    fontFamily: FONT.bold,
    marginBottom: 12,
    marginTop: 4,
  },

  buttonBase: {
    minHeight: 46,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    flexShrink: 1,
  },

  buttonPrimary: {
    backgroundColor: WHITE,
  },

  buttonSecondary: {
    backgroundColor: CARD_BG_STRONG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonIcon: {
    marginRight: 8,
  },

  buttonText: {
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  buttonTextPrimary: {
    color: "#0C6A80",
  },

  buttonTextSecondary: {
    color: WHITE,
  },

  infoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: SPACING.lg,
  },

  infoTitle: {
    color: WHITE,
    fontSize: 15,
    fontFamily: FONT.bold,
  },

  infoDescription: {
    color: SOFT_TEXT_2,
    fontSize: 13,
    lineHeight: 21,
    fontFamily: FONT.medium,
    marginTop: 10,
  },

  formCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: SPACING.lg,
  },

  inputWrap: {
    marginBottom: SPACING.md,
  },

  inputLabel: {
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.bold,
    marginBottom: 8,
  },

  input: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: WHITE,
    fontSize: 14,
    fontFamily: FONT.medium,
    backgroundColor: CARD_BG_STRONG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  textArea: {
    minHeight: 92,
    textAlignVertical: "top",
  },

  dropdownTrigger: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: CARD_BG_STRONG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dropdownText: {
    color: WHITE,
    fontSize: 14,
    fontFamily: FONT.medium,
  },

  dropdownMenu: {
    marginTop: 8,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: "hidden",
  },

  dropdownItem: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD_BG_STRONG,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  dropdownItemActive: {
    backgroundColor: "rgba(255,255,255,0.92)",
  },

  dropdownItemText: {
    color: WHITE,
    fontSize: 14,
    fontFamily: FONT.medium,
  },

  dropdownItemTextActive: {
    color: "#0C6A80",
    fontFamily: FONT.bold,
  },

  linkCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: SPACING.md,
  },

  savedTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  savedTextWrap: {
    flex: 1,
    marginRight: 10,
  },

  linkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
    marginRight: 12,
  },

  linkCardTitle: {
    color: WHITE,
    fontSize: 15,
    fontFamily: FONT.bold,
  },

  cardSubText: {
    color: SOFT_TEXT,
    fontSize: 12,
    marginTop: 4,
    fontFamily: FONT.medium,
  },

  savedStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },

  savedStatusActive: {
    backgroundColor: "rgba(140,240,199,0.18)",
  },

  savedStatusInactive: {
    backgroundColor: "rgba(255,204,102,0.18)",
  },

  savedStatusText: {
    color: WHITE,
    fontSize: 11,
    fontFamily: FONT.bold,
  },

  savedMetaText: {
    color: SOFT_TEXT_2,
    fontSize: 12,
    fontFamily: FONT.medium,
    marginBottom: 8,
  },

  noteText: {
    color: WHITE,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.medium,
    marginBottom: SPACING.sm,
  },

  lockedNotice: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: CARD_BG_STRONG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  lockedNoticeText: {
    flex: 1,
    color: WHITE,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.medium,
  },

  bottomActions: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
});