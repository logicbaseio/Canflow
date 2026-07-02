import z from "zod";

// Board schemas
export const BoardSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  board_type: z.string().default('kanban'),
  public_key: z.string().nullable(),
  is_public: z.boolean().default(false),
  public_theme: z.string().default('auto'),
  invite_mode: z.string().default('none'),
  github_repo: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateBoardSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  color: z.string().optional(),
  board_type: z.enum(['kanban', 'roadmap', 'beta-testing']).default('kanban'),
});

export const UpdateBoardSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  board_type: z.enum(['kanban', 'roadmap', 'beta-testing']).optional(),
  is_public: z.boolean().optional(),
  public_theme: z.enum(['auto', 'light', 'dark']).optional(),
  invite_mode: z.enum(['none', 'email']).optional(),
  github_repo: z.string().nullable().optional(),
});

// Column schemas
export const ColumnSchema = z.object({
  id: z.number(),
  board_id: z.number(),
  title: z.string(),
  position: z.number(),
  color: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateColumnSchema = z.object({
  board_id: z.number(),
  title: z.string().min(1, "Title is required"),
  position: z.number(),
  color: z.string().optional(),
});

export const UpdateColumnSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  position: z.number().optional(),
  color: z.string().optional(),
});

// Task schemas
export const TaskSchema = z.object({
  id: z.number(),
  column_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  position: z.number(),
  priority: z.string().nullable(),
  due_date: z.string().nullable(),
  tags: z.string().nullable(),
  intensity: z.number().default(0),
  category: z.string().nullable(),
  image_url: z.string().nullable(),
  github_issue_number: z.number().nullable().optional(),
  github_url: z.string().nullable().optional(),
  upvotes: z.number().default(0),
  downvotes: z.number().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateTaskSchema = z.object({
  column_id: z.number(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  position: z.number(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  due_date: z.string().optional(),
  tags: z.string().optional(),
  intensity: z.number().min(0).max(10).optional(),
  category: z.string().optional(),
  image_url: z.string().nullable().optional(),
});

export const UpdateTaskSchema = z.object({
  column_id: z.number().optional(),
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional(),
  position: z.number().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  due_date: z.string().optional(),
  tags: z.string().optional(),
  intensity: z.number().min(0).max(10).optional(),
  category: z.string().optional(),
  image_url: z.string().nullable().optional(),
});

export const MoveTaskSchema = z.object({
  column_id: z.number(),
  position: z.number(),
});

export const VoteTaskSchema = z.object({
  vote_type: z.enum(['upvote', 'downvote']),
});

// Invitation schemas
export const InvitationSchema = z.object({
  id: z.number(),
  board_id: z.number(),
  column_id: z.number().nullable(),
  email: z.string(),
  invited_by: z.string().nullable(),
  status: z.string().default('pending'),
  token: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateInvitationSchema = z.object({
  board_id: z.number(),
  column_id: z.number().optional(),
  email: z.string().email(),
  invited_by: z.string().optional(),
});

// Beta Category schemas
export const BetaCategorySchema = z.object({
  id: z.number(),
  board_id: z.number(),
  name: z.string(),
  color: z.string().default('#6b7280'),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateBetaCategorySchema = z.object({
  board_id: z.number(),
  name: z.string().min(1, "Name is required"),
  color: z.string().optional(),
});

// Type exports
export type Board = z.infer<typeof BoardSchema>;
export type CreateBoard = z.infer<typeof CreateBoardSchema>;
export type UpdateBoard = z.infer<typeof UpdateBoardSchema>;

export type Column = z.infer<typeof ColumnSchema>;
export type CreateColumn = z.infer<typeof CreateColumnSchema>;
export type UpdateColumn = z.infer<typeof UpdateColumnSchema>;

export type Task = z.infer<typeof TaskSchema>;
export type CreateTask = z.infer<typeof CreateTaskSchema>;
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;
export type MoveTask = z.infer<typeof MoveTaskSchema>;
export type VoteTask = z.infer<typeof VoteTaskSchema>;

export type Invitation = z.infer<typeof InvitationSchema>;
export type CreateInvitation = z.infer<typeof CreateInvitationSchema>;

export type BetaCategory = z.infer<typeof BetaCategorySchema>;
export type CreateBetaCategory = z.infer<typeof CreateBetaCategorySchema>;

export type BoardWithColumns = Board & {
  columns: (Column & {
    tasks: Task[];
  })[];
};
