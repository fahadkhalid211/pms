"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { parseCsvRecords } from "@/lib/csv";
import {
  UserPlus,
  Users,
  Shield,
  Building2,
  Trash2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Upload,
  FileSpreadsheet,
} from "lucide-react";

interface StaffMember {
  id: string;
  userId: string;
  roleKey: string | null;
  status: "active" | "invited" | "suspended";
  propertyIds?: string[] | null;
  user?: {
    id: string;
    email: string;
    name: string;
    status: string;
    roleKey: string | null;
    createdAt?: string;
  };
  role?: {
    id: string;
    key: string;
    name: string;
    description: string | null;
  } | null;
}

interface RoleOption {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

interface PropertyOption {
  id: string;
  name: string;
  code: string;
}

const DEFAULT_ROLES: RoleOption[] = [
  { id: "admin", key: "admin", name: "Administrator", description: "Full access to every module within the organization." },
  { id: "manager", key: "manager", name: "Property Manager", description: "Oversight across reservations, billing, rates, and reporting." },
  { id: "front_desk", key: "front_desk", name: "Front Desk", description: "Front desk check-ins, reservations, and guest service operations." },
  { id: "housekeeping", key: "housekeeping", name: "Housekeeping", description: "Housekeeping tasks and maintenance coordination." },
];

export default function StaffPage() {
  const { toast } = useToast();
  const [members, setMembers] = React.useState<StaffMember[]>([]);
  const [roles, setRoles] = React.useState<RoleOption[]>(DEFAULT_ROLES);
  const [properties, setProperties] = React.useState<PropertyOption[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Add Staff Dialog State
  const [createOpen, setCreateOpen] = React.useState(false);
  const [nameInput, setNameInput] = React.useState("");
  const [emailInput, setEmailInput] = React.useState("");
  const [passwordInput, setPasswordInput] = React.useState("");
  const [roleInput, setRoleInput] = React.useState("front_desk");
  const [selectedPropertyIds, setSelectedPropertyIds] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Bulk Import Users State
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkText, setBulkText] = React.useState("");
  const [bulkBusy, setBulkBusy] = React.useState(false);

  const SAMPLE_USERS_CSV = `name,email,role,password,property_codes
Elena Rostova,elena@yourhotel.com,manager,StrongPass123!,
Carlos Mendez,carlos@yourhotel.com,front_desk,FrontDesk123!,
Maria Sanchez,maria@yourhotel.com,housekeeping,,`;

  const parsedBulkUsers = React.useMemo(() => {
    const trimmed = bulkText.trim();
    if (!trimmed) return [];
    const validRoles = new Set(["admin", "manager", "front_desk", "housekeeping"]);
    if (trimmed.startsWith("[")) {
      try {
        const arr = JSON.parse(trimmed);
        return Array.isArray(arr) ? arr.filter((u) => u && u.email && u.name) : [];
      } catch {
        return [];
      }
    }
    return parseCsvRecords(trimmed)
      .filter((r) => (r.email || "").trim() && (r.name || r.full_name || "").trim())
      .map((r) => {
        const rawRole = (r.role || r.role_key || "front_desk").toLowerCase().trim();
        const rawCodes = (r.property_codes || r.properties || "").trim();
        return {
          name: (r.name || r.full_name).trim(),
          email: r.email.trim(),
          roleKey: validRoles.has(rawRole) ? rawRole : "front_desk",
          password: (r.password || "").trim(),
          propertyCodes: rawCodes ? rawCodes.split(/[;|]/).map((s) => s.trim()).filter(Boolean) : [],
        };
      });
  }, [bulkText]);

  function handleBulkFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setBulkText(reader.result);
    };
    reader.readAsText(file);
  }

  async function handleBulkImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedBulkUsers.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/staff/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: parsedBulkUsers }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Bulk user import failed", description: json.error?.message, variant: "destructive" });
        return;
      }
      toast({
        title: "Bulk users imported",
        description: `Imported ${json.data.imported} user(s)${json.data.skippedCount ? ` (${json.data.skippedCount} skipped)` : ""}.`,
      });
      setBulkOpen(false);
      setBulkText("");
      void loadStaff();
    } catch {
      toast({ title: "Network error", description: "Failed to import users.", variant: "destructive" });
    } finally {
      setBulkBusy(false);
    }
  }

  const loadStaff = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff");
      const json = await res.json();
      if (res.ok && json.success) {
        setMembers(Array.isArray(json.data) ? json.data : []);
        if (json.meta?.roles?.length) setRoles(json.meta.roles);
        if (Array.isArray(json.meta?.properties)) setProperties(json.meta.properties);
        if (json.meta?.currentUserId) setCurrentUserId(json.meta.currentUserId);
      } else {
        toast({ title: "Failed to load staff", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not load staff accounts.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  function togglePropertySelection(propId: string) {
    setSelectedPropertyIds((prev) =>
      prev.includes(propId) ? prev.filter((id) => id !== propId) : [...prev, propId],
    );
  }

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameInput,
          email: emailInput,
          password: passwordInput,
          roleKey: roleInput,
          propertyIds: selectedPropertyIds,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          title: "Staff account created",
          description: `${nameInput} (${emailInput}) can now sign in with the password provided.`,
        });
        setCreateOpen(false);
        setNameInput("");
        setEmailInput("");
        setPasswordInput("");
        setRoleInput("front_desk");
        setSelectedPropertyIds([]);
        void loadStaff();
      } else {
        toast({ title: "Could not create staff account", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Failed to create staff member.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateMember(memberId: string, patch: { roleKey?: string; status?: "active" | "suspended" }) {
    setBusyId(memberId);
    try {
      const res = await fetch(`/api/staff/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setMembers((prev) => prev.map((m) => (m.id === memberId ? json.data : m)));
        toast({ title: "Staff member updated" });
      } else {
        toast({ title: "Update failed", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not update staff member.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveMember(member: StaffMember) {
    const label = member.user?.name || member.user?.email || "this staff member";
    if (!window.confirm(`Remove ${label} from the organization? They will immediately lose workspace access.`)) {
      return;
    }
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/staff/${member.id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
        toast({ title: "Staff member removed", description: `${label} has been deactivated.` });
      } else {
        toast({ title: "Removal failed", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not remove staff member.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  const activeRoleDesc = roles.find((r) => r.key === roleInput)?.description;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff and permissions</h1>
          <p className="text-sm text-muted-foreground">
            Add staff accounts, assign operational roles, and scope property access across your team.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadStaff()} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="gap-1.5">
            <Upload className="h-4 w-4" strokeWidth={1.5} />
            Bulk Import Users
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <UserPlus className="h-4 w-4" strokeWidth={1.5} />
            Add Staff Member
          </Button>
        </div>
      </div>

      {/* Role Summary Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => (
          <Card key={role.key} className="border border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" strokeWidth={1.5} />
                {role.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{role.description || "Custom organization role"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Staff Members Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" strokeWidth={1.5} />
            Team Members ({members.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Active team members can sign in at /login with their email and assigned password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading staff accounts...</p>
          ) : members.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No staff members found. Click &ldquo;Add Staff Member&rdquo; to invite your first team member.
            </div>
          ) : (
            members.map((m) => {
              const isSelf = m.userId === currentUserId || m.user?.id === currentUserId;
              const isBusy = busyId === m.id;
              const propScope = Array.isArray(m.propertyIds) ? m.propertyIds : [];
              const scopedNames = properties
                .filter((p) => propScope.includes(p.id))
                .map((p) => p.name);

              return (
                <div
                  key={m.id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border/80 p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {(m.user?.name || m.user?.email || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <span>{m.user?.name ?? m.user?.email}</span>
                        {isSelf && (
                          <Badge variant="outline" className="text-[10px]">
                            You
                          </Badge>
                        )}
                        <Badge variant={m.status === "active" ? "default" : "secondary"} className="text-[10px] capitalize">
                          {m.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{m.user?.email}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Building2 className="h-3 w-3" strokeWidth={1.5} />
                        <span>{scopedNames.length > 0 ? scopedNames.join(", ") : "All properties"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Role for ${m.user?.name ?? m.user?.email}`}
                      value={m.roleKey ?? "front_desk"}
                      disabled={isBusy}
                      onChange={(e) => void handleUpdateMember(m.id, { roleKey: e.target.value })}
                      className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                    >
                      {roles.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.name}
                        </option>
                      ))}
                    </select>

                    {!isSelf && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          className="h-8 text-xs gap-1"
                          onClick={() =>
                            void handleUpdateMember(m.id, {
                              status: m.status === "active" ? "suspended" : "active",
                            })
                          }
                        >
                          {m.status === "active" ? (
                            <>
                              <PauseCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Suspend
                            </>
                          ) : (
                            <>
                              <PlayCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Activate
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1"
                          onClick={() => void handleRemoveMember(m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Add Staff Member Modal */}
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Staff Account"
        description="Create a login account for a property manager, front desk agent, or housekeeper."
      >
        <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="staff-name">Full Name</Label>
            <Input
              id="staff-name"
              placeholder="e.g. Maria Sanchez"
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-email">Work Email</Label>
            <Input
              id="staff-email"
              type="email"
              placeholder="maria@yourhotel.com"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-password">Initial Password</Label>
            <Input
              id="staff-password"
              type="password"
              placeholder="Minimum 8 characters"
              minLength={8}
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-role">Role & Permissions</Label>
            <select
              id="staff-role"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium"
            >
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
            {activeRoleDesc && <p className="text-[11px] text-muted-foreground">{activeRoleDesc}</p>}
          </div>

          {properties.length > 0 && (
            <div className="space-y-1.5">
              <Label>Property Access Scope (leave unchecked for all properties)</Label>
              <div className="max-h-32 overflow-y-auto rounded-md border border-input p-2 space-y-1.5">
                {properties.map((prop) => (
                  <label key={prop.id} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedPropertyIds.includes(prop.id)}
                      onChange={() => togglePropertySelection(prop.id)}
                      className="rounded border-input accent-primary"
                    />
                    <span>
                      {prop.name} <span className="text-muted-foreground">({prop.code})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Creating..." : "Create Staff Account"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Bulk Import Users Modal */}
      <Dialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Bulk Import Staff Accounts"
        description="Upload a CSV file or paste CSV / JSON rows. Users without a password are created as invited."
      >
        <form onSubmit={handleBulkImportSubmit} className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border px-2.5 py-1.5 font-medium hover:bg-muted/40">
              <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
              <span>Upload CSV File</span>
              <input type="file" accept=".csv,.txt,.json" className="hidden" onChange={handleBulkFileUpload} />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setBulkText(SAMPLE_USERS_CSV)}
            >
              Load Sample CSV
            </Button>
          </div>

          <div className="space-y-1">
            <Label htmlFor="bulk-users-text">CSV (headers: name,email,role,password,property_codes) or JSON</Label>
            <textarea
              id="bulk-users-text"
              rows={6}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={SAMPLE_USERS_CSV}
              className="w-full rounded-md border border-input bg-background p-2.5 font-mono text-[11px]"
            />
          </div>

          {parsedBulkUsers.length > 0 && (
            <div className="rounded-md border max-h-36 overflow-y-auto">
              <div className="bg-muted/40 px-2.5 py-1.5 font-semibold border-b">
                Preview: {parsedBulkUsers.length} user(s) ready to import
              </div>
              <div className="divide-y">
                {parsedBulkUsers.slice(0, 10).map((u, idx) => (
                  <div key={idx} className="px-2.5 py-1.5 flex items-center justify-between">
                    <span className="font-medium">{u.name} ({u.email})</span>
                    <span className="text-muted-foreground capitalize">
                      {u.roleKey.replace("_", " ")} · {u.password ? "Active" : "Invited"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={bulkBusy || parsedBulkUsers.length === 0}>
              {bulkBusy ? "Importing..." : `Import ${parsedBulkUsers.length || ""} Users`}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
