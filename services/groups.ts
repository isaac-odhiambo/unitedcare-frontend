// services/groups.ts
// ----------------------------------------------------
// Groups + memberships + join requests + savings summary
// NOTE:
// - Real money payments should go through centralized payments
// - postGroupContribution() is best kept for manual/admin/testing use
// ----------------------------------------------------

import { api } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";

/* =========================================================
   Types
========================================================= */

export type GroupType =
  | "BURIAL"
  | "WEDDING"
  | "EDUCATION"
  | "INVESTMENT"
  | "SAVINGS"
  | "EMERGENCY"
  | "DEVELOPMENT"
  | "OTHER"
  | string;

export type GroupVisibility = "PUBLIC" | "PRIVATE" | string;
export type GroupJoinPolicy = "OPEN" | "APPROVAL" | "CLOSED" | string;

export type Group = {
  id: number;
  name: string;
  payment_code?: string;
  group_type?: GroupType;
  group_type_display?: string;
  description?: string;
  objective?: string;
  created_by?: number;
  visibility?: GroupVisibility;
  join_policy?: GroupJoinPolicy;
  is_active?: boolean;
  max_members?: number;
  available_slots?: number | null;
  member_count?: number;
  requires_contributions?: boolean;
  contribution_amount?: string;
  contribution_frequency?: string;
  created_at?: string;
  updated_at?: string;
  my_membership?: {
    role: MembershipRole;
    joined_at?: string;
  } | null;
};

export type MembershipRole =
  | "MEMBER"
  | "ADMIN"
  | "TREASURER"
  | "SECRETARY"
  | string;

export type GroupMembership = {
  id: number;
  group?: number | Group;
  group_id?: number;
  group_name?: string;
  user?: number | any;
  user_id?: number;
  user_name?: string;
  user_phone?: string;
  role: MembershipRole;
  is_active: boolean;
  joined_at?: string;
};

export type GroupJoinRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | string;

export type GroupJoinRequest = {
  id: number;
  group?: number | Group;
  group_id?: number;
  group_name?: string;
  user?: number;
  user_id?: number;
  user_name?: string;
  note?: string;
  status: GroupJoinRequestStatus;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  created_at?: string;
};

export type GroupFundSummary = {
  balance: string | null;
  reserved_amount: string | null;
  available_balance: string | null;
  visibility?: "admins_only";
};

export type GroupShareSummary = {
  total_contributed: string;
  reserved_share: string;
  available_share: string;
};

export type MyGroupSavingsRow = {
  group: {
    id: number;
    name: string;
    group_type?: GroupType;
    group_type_display?: string;
  };
  my_role: MembershipRole;
  fund: GroupFundSummary;
  my_share: GroupShareSummary;
};

export type GroupContribution = {
  id?: number;
  group?: number;
  group_id?: number;
  user?: number;
  user_id?: number;
  user_name?: string;
  amount: string;
  source?: "MANUAL" | "MPESA" | "BANK" | "OTHER" | string;
  reference?: string | null;
  note?: string | null;
  created_at?: string;
};

export type GroupContributionAdminResponse = {
  group_id: number;
  group_total_from_fund?: string;
  ledger_reference?: string;
  group_total_confirmed?: string;
  per_member_totals?: {
    user_id: number;
    total_contributed: string;
  }[];
  per_member_totals_confirmed?: {
    user_id: number;
    total_contributed_confirmed: string;
  }[];
  history: GroupContribution[];
};

export type PostGroupContributionPayload = {
  group_id: number;
  amount: string;
  source?: "MANUAL" | "MPESA" | "BANK" | "OTHER" | string;
  reference?: string;
  note?: string;
};

export type CreateGroupPayload = {
  name: string;
  group_type?: GroupType;
  description?: string;
  objective?: string;
  visibility?: GroupVisibility;
  join_policy?: GroupJoinPolicy;
  is_active?: boolean;
  max_members?: number;
  requires_contributions?: boolean;
  contribution_amount?: string;
  contribution_frequency?: string;
};

export type UpdateGroupPayload = Partial<CreateGroupPayload>;

export type CreateMembershipPayload = {
  group: number;
  user: number;
  role?: MembershipRole;
  is_active?: boolean;
};

export type UpdateMembershipPayload = Partial<{
  role: MembershipRole;
  is_active: boolean;
}>;

export type CreateGroupJoinRequestPayload = {
  group?: number;
  group_id?: number;
  note?: string;
};

/* =========================================================
   Helpers
========================================================= */

function asArray<T>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function asObject<T>(value: any, fallback: T): T {
  return value && typeof value === "object" ? (value as T) : fallback;
}

export function getGroupIdFromMembership(m: GroupMembership): number | null {
  const g: any = m?.group;
  if (typeof g === "number") return g;
  if (g && typeof g === "object" && typeof g.id === "number") return g.id;
  if (typeof m?.group_id === "number") return m.group_id;
  return null;
}

export function getGroupNameFromMembership(m: GroupMembership): string {
  if (m?.group_name) return m.group_name;
  const g: any = m?.group;
  if (g && typeof g === "object" && typeof g.name === "string") return g.name;
  return `Group #${getGroupIdFromMembership(m) ?? "—"}`;
}

export function getGroupDisplayName(g: Group): string {
  return g?.name || `Group #${g?.id ?? "—"}`;
}

export function getJoinRequestGroupId(r: GroupJoinRequest): number | null {
  const g: any = r?.group;
  if (typeof g === "number") return g;
  if (g && typeof g === "object" && typeof g.id === "number") return g.id;
  if (typeof r?.group_id === "number") return r.group_id;
  return null;
}

export function getJoinRequestGroupName(r: GroupJoinRequest): string {
  if (r?.group_name) return r.group_name;
  const g: any = r?.group;
  if (g && typeof g === "object" && typeof g.name === "string") return g.name;
  return `Group #${getJoinRequestGroupId(r) ?? "—"}`;
}

/* =========================================================
   Groups
========================================================= */

export async function listGroups(params?: {
  mine?: boolean;
  only_open?: boolean;
  group_type?: string;
  is_active?: boolean;
}): Promise<Group[]> {
  const res = await api.get(ENDPOINTS.groups.groups, { params });
  return asArray<Group>(res.data);
}

export async function listAvailableGroups(): Promise<Group[]> {
  const endpoint = ENDPOINTS.groups.available || ENDPOINTS.groups.groups;

  const res = await api.get(endpoint);
  return asArray<Group>(res.data);
}

// Safe alias so screens using either name will work
export const listPublicGroups = listAvailableGroups;

export async function getGroup(groupId: number): Promise<Group> {
  const res = await api.get(ENDPOINTS.groups.detail(groupId));
  return asObject<Group>(res.data, {} as Group);
}

export async function createGroup(payload: CreateGroupPayload): Promise<{
  message: string;
  group: Group;
}> {
  const res = await api.post(ENDPOINTS.groups.groups, payload);
  return asObject(res.data, {
    message: "Group created successfully.",
    group: {} as Group,
  });
}

export async function updateGroup(
  groupId: number,
  payload: UpdateGroupPayload
): Promise<{
  message: string;
  group: Group;
}> {
  const res = await api.patch(ENDPOINTS.groups.detail(groupId), payload);
  return asObject(res.data, {
    message: "Group updated successfully.",
    group: {} as Group,
  });
}

export async function deleteGroup(groupId: number): Promise<void> {
  await api.delete(ENDPOINTS.groups.detail(groupId));
}

/* =========================================================
   Memberships
========================================================= */

export async function listGroupMemberships(
  groupId?: number
): Promise<GroupMembership[]> {
  const res = await api.get(ENDPOINTS.groups.memberships, {
    params: groupId ? { group: groupId } : undefined,
  });
  return asArray<GroupMembership>(res.data);
}

export async function getMembership(
  membershipId: number
): Promise<GroupMembership> {
  const res = await api.get(ENDPOINTS.groups.membershipDetail(membershipId));
  return asObject<GroupMembership>(res.data, {} as GroupMembership);
}

export async function createMembership(
  payload: CreateMembershipPayload
): Promise<GroupMembership> {
  const res = await api.post(ENDPOINTS.groups.memberships, payload);
  return asObject<GroupMembership>(res.data, {} as GroupMembership);
}

export async function updateGroupMembership(
  membershipId: number,
  payload: UpdateMembershipPayload
): Promise<GroupMembership> {
  const res = await api.patch(
    ENDPOINTS.groups.membershipDetail(membershipId),
    payload
  );
  return asObject<GroupMembership>(res.data, {} as GroupMembership);
}

export async function removeGroupMember(
  membershipId: number
): Promise<{ message: string }> {
  const res = await api.delete(ENDPOINTS.groups.membershipDetail(membershipId));
  return asObject(res.data, { message: "Member removed successfully." });
}

/* =========================================================
   Join Requests
========================================================= */

export async function listMyGroupJoinRequests(): Promise<GroupJoinRequest[]> {
  const res = await api.get(ENDPOINTS.groups.joinRequests, {
    params: { mine: true },
  });
  return asArray<GroupJoinRequest>(res.data);
}

export async function listGroupJoinRequests(
  groupId: number
): Promise<GroupJoinRequest[]> {
  const res = await api.get(ENDPOINTS.groups.joinRequests, {
    params: { group: groupId },
  });
  return asArray<GroupJoinRequest>(res.data);
}

export async function createGroupJoinRequest(
  payload: CreateGroupJoinRequestPayload
): Promise<{
  id?: number;
  group_id?: number;
  user_id?: number;
  status?: string;
  membership_id?: number;
  role?: string;
  message: string;
}> {
  const normalizedPayload = {
    group:
      typeof payload.group === "number"
        ? payload.group
        : typeof payload.group_id === "number"
        ? payload.group_id
        : undefined,
    note: payload.note || "",
  };

  const res = await api.post(ENDPOINTS.groups.joinRequests, normalizedPayload);
  return asObject(res.data, { message: "Join request submitted." });
}

export async function approveGroupJoinRequest(requestId: number): Promise<any> {
  const res = await api.post(ENDPOINTS.groups.approveJoinRequest(requestId));
  return res.data;
}

export async function rejectGroupJoinRequest(
  requestId: number,
  note?: string
): Promise<any> {
  const res = await api.post(ENDPOINTS.groups.rejectJoinRequest(requestId), {
    note: note || "",
  });
  return res.data;
}

export async function cancelGroupJoinRequest(requestId: number): Promise<any> {
  const res = await api.post(ENDPOINTS.groups.cancelJoinRequest(requestId));
  return res.data;
}

/* =========================================================
   Group Savings
========================================================= */

export async function getMyGroupSavingsSummary(): Promise<MyGroupSavingsRow[]> {
  const res = await api.get(ENDPOINTS.groups.mySavings);
  return asArray<MyGroupSavingsRow>(res.data);
}

/* =========================================================
   Group Contributions
========================================================= */

/**
 * Keep this for manual/admin/testing use.
 * Real money payments should go through centralized payments.
 */
export async function postGroupContribution(
  payload: PostGroupContributionPayload
): Promise<any> {
  const res = await api.post(ENDPOINTS.groups.contribute, payload);
  return res.data;
}

export async function getMyGroupContributions(
  groupId: number
): Promise<GroupContribution[]> {
  if (!groupId || Number.isNaN(Number(groupId))) return [];

  const res = await api.get(ENDPOINTS.groups.myContributions(groupId));
  return asArray<GroupContribution>(res.data);
}

export async function getAllGroupContributions(
  groupId: number
): Promise<GroupContributionAdminResponse> {
  const res = await api.get(ENDPOINTS.groups.allContributions(groupId));
  return asObject<GroupContributionAdminResponse>(res.data, {
    group_id: groupId,
    history: [],
  });
}

/* =========================================================
   Group Dependants
========================================================= */

export type GroupDependant = {
  id: number;
  membership: number;
  group_id?: number;
  group_name?: string;
  user_id?: number;
  user_name?: string;
  name: string;
  relationship: "SPOUSE" | "CHILD" | "SIBLING" | "PARENT" | "OTHER" | string;
  relationship_display?: string;
  date_of_birth?: string | null;
  note?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

/**
 * List dependants (optionally per group)
 */
export async function listGroupDependants(params?: {
  group_id?: number;
}): Promise<GroupDependant[]> {
  const res = await api.get(ENDPOINTS.groups.dependants, {
    params,
  });
  return asArray<GroupDependant>(res.data);
}

/**
 * Add dependant
 */
export async function addGroupDependant(payload: {
  membership: number;
  name: string;
  relationship: string;
  date_of_birth?: string;
  note?: string;
}): Promise<GroupDependant> {
  const res = await api.post(ENDPOINTS.groups.dependants, payload);
  return asObject<GroupDependant>(res.data, {} as GroupDependant);
}

/**
 * Update dependant
 */
export async function updateGroupDependant(
  dependantId: number,
  payload: Partial<{
    name: string;
    relationship: string;
    date_of_birth: string;
    note: string;
  }>
): Promise<GroupDependant> {
  const res = await api.patch(
    `${ENDPOINTS.groups.dependants}${dependantId}/`,
    payload
  );
  return asObject<GroupDependant>(res.data, {} as GroupDependant);
}

/**
 * Remove dependant (soft delete)
 */
export async function removeGroupDependant(
  dependantId: number
): Promise<{ message: string }> {
  const res = await api.delete(
    `${ENDPOINTS.groups.dependants}${dependantId}/`
  );
  return asObject(res.data, { message: "Dependant removed." });
}

/* =========================================================
   Friendly Error Message
========================================================= */

export function getApiErrorMessage(error: any): string {
  const data = error?.response?.data;

  if (!error?.response) {
    if (error?.code === "ECONNABORTED") {
      return "Request timed out. Please try again.";
    }
    return (
      error?.message || "Network error. Check your connection and try again."
    );
  }

  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;

  if (typeof data === "object") {
    const firstKey = Object.keys(data)[0];
    const firstValue = data?.[firstKey];

    if (Array.isArray(firstValue) && firstValue.length > 0) {
      return `${firstKey}: ${firstValue[0]}`;
    }

    if (typeof firstValue === "string") {
      return `${firstKey}: ${firstValue}`;
    }
  }

  const status = error?.response?.status;
  if (status === 400) return "Invalid request. Please check your input.";
  if (status === 401) return "Session expired. Please login again.";
  if (status === 403) return "Access denied.";
  if (status === 404) return "Endpoint not found.";
  if (status === 405) return "Method not allowed.";
  if (status && status >= 500) return "Server error. Please try again later.";

  return "Request failed.";
}