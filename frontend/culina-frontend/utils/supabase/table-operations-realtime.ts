import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/client";

type TableOpsRealtimeOptions = {
  restaurantId: string;
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onStatusChange?: (status: ChannelStatus) => void;
  onError?: (error: Error) => void;
  debounceMs?: number;
};

// All possible channel statuses from Supabase
export type ChannelStatus =
  | "SUBSCRIBED"
  | "SUBSCRIBING"
  | "UNSUBSCRIBED"
  | "TIMED_OUT"
  | "CLOSED"
  | "CHANNEL_ERROR"
  | "JOINING"
  | "JOINED"
  | "LEAVING"
  | "LEFT";

const TABLES = ["orders", "restaurant_tables"] as const;
const EVENTS = ["INSERT", "UPDATE", "DELETE"] as const;

export type TableOpsRealtimePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

function getRecordStringValue(record: Record<string, unknown> | null | undefined, key: string) {
  const rawValue = record?.[key];
  if (typeof rawValue === "string" && rawValue.length > 0) {
    return rawValue;
  }
  if (typeof rawValue === "number" && !isNaN(rawValue)) {
    return String(rawValue);
  }
  // Accept UUIDs or other non-empty values
  if (rawValue && typeof rawValue === "string") {
    return rawValue;
  }
  return null;
}

export function extractAffectedTableIds(payload: TableOpsRealtimePayload) {
  const tableIds = new Set<string>();

  if (payload.table === "restaurant_tables") {
    const newId = getRecordStringValue(payload.new, "id");
    const oldId = getRecordStringValue(payload.old, "id");
    if (newId) {
      tableIds.add(newId);
    }
    if (oldId) {
      tableIds.add(oldId);
    }
    return Array.from(tableIds);
  }

  if (payload.table === "orders") {
    const newTableId = getRecordStringValue(payload.new, "table_id");
    const oldTableId = getRecordStringValue(payload.old, "table_id");
    if (newTableId) {
      tableIds.add(newTableId);
    }
    if (oldTableId) {
      tableIds.add(oldTableId);
    }
  }

  return Array.from(tableIds);
}

export function subscribeToTableOperationsRealtime({
  restaurantId,
  onChange,
  onStatusChange,
  onError,
  debounceMs = 200,
}: TableOpsRealtimeOptions) {
  const supabase = createClient();
  const channelName = `table-operations:${restaurantId}:${Date.now()}`;
  const channel = supabase.channel(channelName);
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const notifyWithDebounce = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    timeoutHandle = setTimeout(() => {
      timeoutHandle = null;
      onChange(payload);
    }, debounceMs);
  };

  TABLES.forEach((table) => {
    EVENTS.forEach((event) => {
      channel.on(
        "postgres_changes",
        {
          event,
          schema: "public",
          table,
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          notifyWithDebounce(payload as RealtimePostgresChangesPayload<Record<string, unknown>>);
        }
      );
    });
  });

  channel.subscribe((status) => {
    onStatusChange?.(status);

    if (status === "CHANNEL_ERROR") {
      onError?.(new Error(`Realtime channel error for ${channelName}`));
    }
  });

  return () => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    void supabase.removeChannel(channel as RealtimeChannel);
  };
}
