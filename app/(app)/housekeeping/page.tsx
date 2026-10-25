"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Sparkles, CheckCircle2, Play, MessageSquare, Paperclip, UploadCloud, RefreshCw } from "lucide-react";

interface TaskComment {
  id: string;
  body: string;
  createdAt: string;
  authorId?: string | null;
}

interface Task {
  id: string;
  propertyId: string;
  roomId: string;
  status: string;
  priority: string;
  title: string | null;
  notes: string | null;
  dueAt: string | null;
  completedAt: string | null;
  room: { id: string; number: string; status: string; roomType: { name: string } | null } | null;
  comments?: TaskComment[];
}

interface Property {
  id: string;
  name: string;
}

interface Room {
  id: string;
  number: string;
  propertyId: string;
  status: string;
  roomType?: { name: string };
}

export default function HousekeepingPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string>("");
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [loading, setLoading] = React.useState(true);

  // New task form state
  const [roomId, setRoomId] = React.useState("");
  const [priority, setPriority] = React.useState("normal");
  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Comments & Attachments dialog
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [comments, setComments] = React.useState<TaskComment[]>([]);
  const [commentText, setCommentText] = React.useState("");
  const [commentPending, setCommentPending] = React.useState(false);

  // File upload state
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadedUrl, setUploadedUrl] = React.useState<string | null>(null);

  const load = React.useCallback(async (propId?: string) => {
    setLoading(true);
    try {
      const pId = propId || selectedPropertyId;
      const tasksUrl = pId ? `/api/housekeeping?propertyId=${pId}` : "/api/housekeeping";
      const res = await fetch(tasksUrl);
      const json = await res.json();
      if (res.ok && json.success) setTasks(json.data);

      const propsRes = await fetch("/api/properties");
      const propsJson = await propsRes.json();
      if (propsRes.ok && propsJson.success && propsJson.data.length > 0) {
        setProperties(propsJson.data);
        if (!selectedPropertyId && !propId) {
          setSelectedPropertyId(propsJson.data[0].id);
        }
      }

      const roomsUrl = pId ? `/api/rooms?propertyId=${pId}` : "/api/rooms";
      const roomsRes = await fetch(roomsUrl);
      const roomsJson = await roomsRes.json();
      if (roomsRes.ok && roomsJson.success) setRooms(roomsJson.data ?? []);
    } catch (e: any) {
      toast({ title: "Failed to load housekeeping tasks", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handlePropertyChange(propId: string) {
    setSelectedPropertyId(propId);
    setRoomId("");
    await load(propId);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedPropertyId || !roomId) {
      setError("Please select both a property and a room.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/housekeeping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          roomId,
          status: "pending",
          priority,
          title: title || "Turnover Cleaning",
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to create task");
        return;
      }
      toast({ title: "Housekeeping task created", description: "Cleaning task scheduled for assignment." });
      setTitle("");
      setNotes("");
      setRoomId("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error creating task");
    } finally {
      setPending(false);
    }
  }

  async function updateStatus(taskId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/housekeeping/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Failed to update task", description: json.error?.message, variant: "destructive" });
        return;
      }
      toast({
        title: `Task status: ${newStatus.replace(/_/g, " ")}`,
        description: newStatus === "completed" ? "Room status automatically updated to clean." : undefined,
      });
      await load();
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message, variant: "destructive" });
    }
  }

  async function openTaskDetails(task: Task) {
    setActiveTask(task);
    setUploadedUrl(null);
    setUploadFile(null);
    try {
      const res = await fetch(`/api/housekeeping/${task.id}/comments`);
      const json = await res.json();
      if (res.ok && json.success) setComments(json.data ?? []);
    } catch {
      setComments([]);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTask || !commentText.trim()) return;

    setCommentPending(true);
    try {
      let fullBody = commentText.trim();
      if (uploadedUrl) {
        fullBody += `\n[Attached Photo/Document](${uploadedUrl})`;
      }

      const res = await fetch(`/api/housekeeping/${activeTask.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: fullBody }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setComments((prev) => [...prev, json.data]);
        setCommentText("");
        setUploadedUrl(null);
        setUploadFile(null);
        toast({ title: "Comment recorded" });
      }
    } finally {
      setCommentPending(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Upload failed", description: json.error?.message, variant: "destructive" });
        return;
      }
      setUploadedUrl(json.data.urlPath);
      toast({ title: "File uploaded securely", description: `${json.data.originalFilename} saved.` });
    } catch (err: any) {
      toast({ title: "Upload error", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const activeRooms = selectedPropertyId ? rooms.filter((r) => r.propertyId === selectedPropertyId) : rooms;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Housekeeping Operations</h1>
          <p className="text-muted-foreground">Cleaning task queue, real-time room readiness, and inspection history.</p>
        </div>
        <div className="flex items-center gap-2">
          {properties.length > 1 && (
            <Select value={selectedPropertyId} onChange={(e) => void handlePropertyChange(e.target.value)}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Task List Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active Cleaning Queue ({tasks.length})</CardTitle>
            <CardDescription>Completing cleaning automatically transitions rooms from dirty to clean.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading tasks…</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">All rooms clean! No active housekeeping tasks.</p>
            ) : (
              tasks.map((t) => (
                <div key={t.id} className="flex flex-col gap-3 rounded-lg border p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      <span>{t.title ?? "Room Cleaning"}</span>
                      <Badge variant={t.priority === "urgent" ? "destructive" : t.priority === "high" ? "default" : "secondary"}>
                        {t.priority}
                      </Badge>
                      <Badge variant={t.status === "completed" ? "default" : t.status === "in_progress" ? "secondary" : "muted"}>
                        {t.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Room {t.room?.number ?? "—"} ({t.room?.roomType?.name ?? "Standard"}) · Current status:{" "}
                      <span className="font-medium text-foreground">{t.room?.status ?? "unknown"}</span>
                    </div>
                    {t.notes && <div className="mt-1 text-xs text-muted-foreground italic">{t.notes}</div>}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => void openTaskDetails(t)}>
                      <MessageSquare className="mr-1 h-3.5 w-3.5" />
                      Notes
                    </Button>
                    {t.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => void updateStatus(t.id, "in_progress")}>
                        <Play className="mr-1 h-3.5 w-3.5" /> Start
                      </Button>
                    )}
                    {t.status === "in_progress" && (
                      <Button size="sm" variant="default" onClick={() => void updateStatus(t.id, "completed")}>
                        <Sparkles className="mr-1 h-3.5 w-3.5" /> Complete
                      </Button>
                    )}
                    {t.status === "completed" && (
                      <Button size="sm" variant="outline" onClick={() => void updateStatus(t.id, "cancelled")}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Done
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Create Task Form */}
        <Card>
          <CardHeader>
            <CardTitle>Dispatch Cleaning</CardTitle>
            <CardDescription>Assign a room cleaning or turnover task.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3.5" onSubmit={onSubmit}>
              {properties.length > 1 && (
                <div className="space-y-1.5">
                  <Label>Property</Label>
                  <Select value={selectedPropertyId} onChange={(e) => void handlePropertyChange(e.target.value)}>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Room</Label>
                <Select value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
                  <option value="">Select room…</option>
                  {activeRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.number} ({r.roomType?.name ?? "Room"} - {r.status})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="htitle">Task Title</Label>
                <Input id="htitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Turnover deep clean" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hpriority">Priority</Label>
                <Select id="hpriority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hnotes">Special Instructions</Label>
                <Input id="hnotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Extra towels, inspect minibar..." />
              </div>

              {error && <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">{error}</div>}

              <Button type="submit" className="w-full" disabled={pending || !roomId}>
                {pending ? "Dispatching…" : "Dispatch Housekeeping Task"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Task Details, Notes & Attachments Modal */}
      <Dialog
        open={Boolean(activeTask)}
        onOpenChange={(open) => !open && setActiveTask(null)}
        title={`Cleaning Notes — Room ${activeTask?.room?.number ?? ""}`}
        description="View instructions, inspection logs, and post photo attachments."
      >
        {activeTask && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="font-semibold">{activeTask.title ?? "Housekeeping Task"}</div>
              <div className="text-xs text-muted-foreground">
                Priority: {activeTask.priority} · Status: {activeTask.status}
              </div>
              {activeTask.notes && <div className="mt-1 text-xs italic">{activeTask.notes}</div>}
            </div>

            {/* Existing Comments */}
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No notes or comments logged yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-md border p-2 text-xs">
                    <div className="text-muted-foreground">{new Date(c.createdAt).toLocaleTimeString()}</div>
                    <div className="mt-0.5 whitespace-pre-wrap">{c.body}</div>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment and Photo Attachment */}
            <form className="space-y-3 border-t pt-3" onSubmit={handleAddComment}>
              <div className="space-y-1.5">
                <Label htmlFor="newComment" className="text-xs">Add Inspection Note</Label>
                <Input
                  id="newComment"
                  placeholder="e.g. Linens replaced, bathroom sanitized, ready for guest."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
              </div>

              {/* Secure Upload Section */}
              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                  <UploadCloud className="h-3.5 w-3.5" />
                  {uploading ? "Uploading..." : uploadedUrl ? "Photo Attached" : "Attach Photo/PDF"}
                  <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={uploading} />
                </label>
                {uploadedUrl && (
                  <span className="flex items-center text-xs text-emerald-600 truncate max-w-[200px]">
                    <Paperclip className="mr-1 h-3 w-3 shrink-0" />
                    {uploadFile ? uploadFile.name : "Uploaded"}
                  </span>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveTask(null)}>Close</Button>
                <Button type="submit" size="sm" disabled={commentPending || (!commentText.trim() && !uploadedUrl)}>
                  {commentPending ? "Saving…" : "Post Note"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </Dialog>
    </div>
  );
}
