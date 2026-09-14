export type RoomStatus = "draft" | "live" | "paused" | "ended";

export interface Room {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  owner_id: string;
  status: RoomStatus;
  time_limit_sec: number;
  base_points: number;
  floor_pct: number;
  timeout_points: number;
  auto_advance: boolean;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface Clue {
  id: string;
  room_id: string;
  order_index: number;
  title: string;
  body: string;
  location_label: string | null;
  hint: string | null;
  qr_token: string;
  points: number | null;
  time_limit_sec: number | null;
}

export interface Team {
  id: string;
  room_id: string;
  name: string;
  join_code: string;
  colour: string;
  route: string[];
  bonus_points: number;
}

export interface Challenge {
  id: string;
  room_id: string;
  title: string;
  description: string;
  points: number;
  target: "all" | "team";
  team_id: string | null;
  status: "open" | "closed";
  expires_at: string | null;
  created_at: string;
}

export interface MyClue {
  step_index: number;
  total_steps: number;
  clue_id: string | null;
  title: string | null;
  body: string | null;
  hint: string | null;
  deadline: string | null;
  time_limit_sec: number;
  points_now: number;
  max_points: number;
  floor_pct: number;
  finished: boolean;
  room_status: RoomStatus;
  last_result: { status: string; points: number; elapsed_sec: number; step_index: number } | null;
}

export interface LeaderRow {
  team_id: string;
  name: string;
  colour: string;
  total_points: number;
  solved_count: number;
  current_index: number;
  route_length: number;
  total_sec: number;
  finished_at: string | null;
  rank: number;
}

export interface AdminTeamState {
  team_id: string;
  name: string;
  join_code: string;
  colour: string;
  total_points: number;
  solved: number;
  current_index: number;
  route_length: number;
  step_started_at: string | null;
  finished_at: string | null;
  members: number;
  bonus: number;
}

export interface ScanResult {
  ok: boolean;
  reason?: string;
  message: string;
  points?: number;
  elapsed_sec?: number;
  max_points?: number;
  step_index?: number;
  finished?: boolean;
}
