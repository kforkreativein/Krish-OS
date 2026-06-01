export const URGENCIES = ["Today", "This Week", "This Month", "Someday"] as const;
export type Urgency = typeof URGENCIES[number];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  urgency: Urgency;
  key: boolean;
  priority_score: number;
  tags: string[];
  due_date: string | null;
  entity_id: string | null;
  owner: string | null;
  completed_at: string | null;
  created_at: string;
}
