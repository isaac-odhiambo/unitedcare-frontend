// services/groups.ts
// ----------------------------------------------------
// Router: groups + memberships
// Extras: my group savings, contribute, contributions history
// ----------------------------------------------------

import { api } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";

/* =========================================================
   Types
========================================================= */

export type Group = {
  id: number;
  name: string;
  created_at?: string;
};

export type MembershipRole = "MEMBER" | "ADMIN" | string;

export type GroupMembership = {
  id: number;
  group?: number | Group;
  user?: number | any;
  role: MembershipRole;
  is_active: boolean;
  joined_at?: string;
};

export type MyGroupSavingsRow = {
  group_id: number;
  group_name: string;
  my_total?: string;
  group_total?: string;
  my_share_pct?: string;
};

export type GroupContribution = {
  id?: number;
  group?: number;
  amount: string;
  created_at?: string;
  reference?: string;
  method?: string;
  mpesa_receipt_number?: string | null;
};

export type PostGroupContributionPayload = {
  group_id: number;
  amount: string;
};

export type CreateGroupPayload = {
  name: string;
};

export type UpdateGroupPayload = Partial<{
  name: string;
}>;

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

/* =========================================================
   Helpers
========================================================= */

export function getGroupIdFromMembership(m: GroupMembership): number | null {
  const g: any = m?.group;
  if (typeof g === "number") return g;
  if (g && typeof g === "object" && typeof g.id === "number") return g.id;
  return null;
}

export function getGroupNameFromMembership(m: GroupMembership): string {
  const g: any = m?.group;
  if (g && typeof g === "object" && typeof g.name === "string") return g.name;
  return `Group #${getGroupIdFromMembership(m) ?? "—"}`;
}

/* =========================================================
   Groups (CRUD)
========================================================= */

export async function listGroups(): Promise<Group[]> {
  const res = await api.get(ENDPOINTS.groups.groups);
  return res.data;
}

export async function getGroup(groupId: number): Promise<Group> {
  const res = await api.get(ENDPOINTS.groups.detail(groupId));
  return res.data;
}

export async function createGroup(payload: CreateGroupPayload): Promise<Group> {
  const res = await api.post(ENDPOINTS.groups.groups, payload);
  return res.data;
}

export async function updateGroup(
  groupId: number,
  payload: UpdateGroupPayload
): Promise<Group> {
  const res = await api.patch(ENDPOINTS.groups.detail(groupId), payload);
  return res.data;
}

export async function deleteGroup(groupId: number): Promise<void> {
  await api.delete(ENDPOINTS.groups.detail(groupId));
}

/* =========================================================
   Memberships (CRUD)
========================================================= */

export async function listGroupMemberships(): Promise<GroupMembership[]> {
  const res = await api.get(ENDPOINTS.groups.memberships);
  return res.data;
}

export async function getMembership(membershipId: number): Promise<GroupMembership> {
  const res = await api.get(ENDPOINTS.groups.membershipDetail(membershipId));
  return res.data;
}

export async function createMembership(
  payload: CreateMembershipPayload
): Promise<GroupMembership> {
  const res = await api.post(ENDPOINTS.groups.memberships, payload);
  return res.data;
}

export async function updateGroupMembership(
  membershipId: number,
  payload: UpdateMembershipPayload
): Promise<GroupMembership> {
  const res = await api.patch(
    ENDPOINTS.groups.membershipDetail(membershipId),
    payload
  );
  return res.data;
}

export async function removeGroupMember(membershipId: number): Promise<void> {
  await api.delete(ENDPOINTS.groups.membershipDetail(membershipId));
}

/* =========================================================
   Group Savings
========================================================= */

export async function getMyGroupSavingsSummary(): Promise<MyGroupSavingsRow[]> {
  const res = await api.get(ENDPOINTS.groups.mySavings);
  return res.data;
}

/* =========================================================
   Group Contributions
========================================================= */

export async function postGroupContribution(
  payload: PostGroupContributionPayload
): Promise<any> {
  const res = await api.post(ENDPOINTS.groups.contribute, payload);
  return res.data;
}

export async function getMyGroupContributions(
  groupId: number
): Promise<GroupContribution[]> {
  const res = await api.get(ENDPOINTS.groups.myContributions(groupId));
  return res.data;
}

export async function getAllGroupContributions(
  groupId: number
): Promise<GroupContribution[]> {
  const res = await api.get(ENDPOINTS.groups.allContributions(groupId));
  return res.data;
}

/* =========================================================
   Friendly Error Message
========================================================= */

export function getApiErrorMessage(error: any): string {
  const data = error?.response?.data;

  if (!data) return "Something went wrong.";
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;

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

  return "Request failed.";
}



// // services/groups.ts (COMPLETE + UPDATED for your groups/urls.py)
// // ----------------------------------------------------
// // - Router: groups + memberships
// // - Extras: my group savings, contribute, contributions history

// import { api, ENDPOINTS } from "@/services/api";

// /* =========================================================
//    Types
// ========================================================= */
// export type Group = {
//   id: number;
//   name: string;
//   created_at?: string;
// };

// export type MembershipRole = "MEMBER" | "ADMIN" | string;

// export type GroupMembership = {
//   id: number;
//   group?: number | Group;
//   user?: number | any;
//   role: MembershipRole;
//   is_active: boolean;
//   joined_at?: string;
// };

// /** What MyGroupSavingsSummaryView returns (guess-friendly).
//  * Adjust fields if your backend returns different ones.
//  */
// export type MyGroupSavingsRow = {
//   group_id: number;
//   group_name: string;
//   my_total?: string;      // my contributions total into this group
//   group_total?: string;   // total group fund
//   my_share_pct?: string;  // optional
// };

// export type GroupContribution = {
//   id?: number;
//   group?: number;
//   amount: string;
//   created_at?: string;
//   reference?: string;
//   method?: string; // MPESA / MANUAL if you expose it
//   mpesa_receipt_number?: string | null;
// };

// export type PostGroupContributionPayload = {
//   group_id: number;
//   amount: string; // decimal string
//   // optional fields if your backend supports:
//   // narration?: string;
// };

// /* =========================================================
//    Helpers
// ========================================================= */
// export function getGroupIdFromMembership(m: GroupMembership): number | null {
//   const g: any = (m as any)?.group;
//   if (typeof g === "number") return g;
//   if (g && typeof g === "object" && typeof g.id === "number") return g.id;
//   return null;
// }

// export function getGroupNameFromMembership(m: GroupMembership): string {
//   const g: any = (m as any)?.group;
//   if (g && typeof g === "object" && typeof g.name === "string") return g.name;
//   return `Group #${getGroupIdFromMembership(m) ?? "—"}`;
// }

// /* =========================================================
//    Groups (CRUD)
// ========================================================= */
// export async function listGroups(): Promise<Group[]> {
//   const res = await api.get(ENDPOINTS.groups.groups);
//   return res.data;
// }

// export async function getGroup(pk: number): Promise<Group> {
//   const res = await api.get(ENDPOINTS.groups.groupDetail(pk));
//   return res.data;
// }

// export async function createGroup(payload: { name: string }): Promise<Group> {
//   const res = await api.post(ENDPOINTS.groups.groups, payload);
//   return res.data;
// }

// export async function updateGroup(pk: number, payload: Partial<{ name: string }>): Promise<Group> {
//   const res = await api.patch(ENDPOINTS.groups.groupDetail(pk), payload);
//   return res.data;
// }

// export async function deleteGroup(pk: number): Promise<void> {
//   await api.delete(ENDPOINTS.groups.groupDetail(pk));
// }

// /* =========================================================
//    Memberships (CRUD)
// ========================================================= */
// export async function listGroupMemberships(): Promise<GroupMembership[]> {
//   const res = await api.get(ENDPOINTS.groups.memberships);
//   return res.data;
// }

// export async function getMembership(pk: number): Promise<GroupMembership> {
//   const res = await api.get(ENDPOINTS.groups.membershipDetail(pk));
//   return res.data;
// }

// export async function createMembership(payload: {
//   group: number;
//   user: number;
//   role?: MembershipRole;
//   is_active?: boolean;
// }): Promise<GroupMembership> {
//   const res = await api.post(ENDPOINTS.groups.memberships, payload);
//   return res.data;
// }

// export async function updateGroupMembership(
//   membershipId: number,
//   payload: Partial<{ role: MembershipRole; is_active: boolean }>
// ): Promise<GroupMembership> {
//   const res = await api.patch(ENDPOINTS.groups.membershipDetail(membershipId), payload);
//   return res.data;
// }

// export async function removeGroupMember(membershipId: number): Promise<void> {
//   await api.delete(ENDPOINTS.groups.membershipDetail(membershipId));
// }

// /* =========================================================
//    Group Savings (your extras)
// ========================================================= */
// export async function getMyGroupSavingsSummary(): Promise<MyGroupSavingsRow[]> {
//   const res = await api.get(ENDPOINTS.groups.mySavings);
//   return res.data;
// }

// /* =========================================================
//    Group Contributions (your extras)
// ========================================================= */
// export async function postGroupContribution(payload: PostGroupContributionPayload) {
//   const res = await api.post(ENDPOINTS.groups.contribute, payload);
//   return res.data;
// }

// export async function getMyGroupContributions(groupId: number): Promise<GroupContribution[]> {
//   const res = await api.get(ENDPOINTS.groups.myContributions(groupId));
//   return res.data;
// }

// export async function getAllGroupContributions(groupId: number): Promise<GroupContribution[]> {
//   const res = await api.get(ENDPOINTS.groups.allContributions(groupId));
//   return res.data;
// }

// /* =========================================================
//    Friendly Error Message
// ========================================================= */
// export function getApiErrorMessage(e: any) {
//   const data = e?.response?.data;
//   if (!data) return "Something went wrong.";
//   if (typeof data === "string") return data;
//   if (typeof data?.detail === "string") return data.detail;

//   if (typeof data === "object") {
//     const k = Object.keys(data)[0];
//     const v = (data as any)[k];
//     if (Array.isArray(v) && v.length) return `${k}: ${v[0]}`;
//     if (typeof v === "string") return `${k}: ${v}`;
//   }
//   return "Request failed.";
// }