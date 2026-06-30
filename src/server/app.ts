import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import {
  CreateBoardSchema,
  UpdateBoardSchema,
  CreateColumnSchema,
  UpdateColumnSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  MoveTaskSchema,
  VoteTaskSchema,
  CreateInvitationSchema,
  CreateBetaCategorySchema,
  type BoardWithColumns,
  type Board,
  type Column,
  type Task,
} from "../shared/types";
import { query, one } from "./db";

const app = new Hono().basePath("/api");

app.use("*", cors());

/* ----------------------------- Boards ----------------------------- */

app.get("/boards", async (c) => {
  const boards = await query<Board>("SELECT * FROM boards ORDER BY created_at DESC");
  return c.json(boards);
});

app.get("/boards/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const board = await one<Board>("SELECT * FROM boards WHERE id = $1", [id]);
  if (!board) return c.json({ error: "Board not found" }, 404);

  const columns = await query<Column>(
    "SELECT * FROM columns WHERE board_id = $1 ORDER BY position",
    [id]
  );

  const boardWithColumns: BoardWithColumns = { ...board, columns: [] };
  for (const column of columns) {
    const tasks = await query<Task>(
      "SELECT * FROM tasks WHERE column_id = $1 ORDER BY position",
      [column.id]
    );
    boardWithColumns.columns.push({ ...column, tasks });
  }
  return c.json(boardWithColumns);
});

app.post("/boards", zValidator("json", CreateBoardSchema), async (c) => {
  const data = c.req.valid("json");
  const publicKey = crypto.randomUUID();

  const board = await one<Board>(
    `INSERT INTO boards (title, description, color, board_type, public_key, updated_at)
     VALUES ($1, $2, $3, $4, $5, now()) RETURNING *`,
    [data.title, data.description ?? null, data.color ?? null, data.board_type ?? "kanban", publicKey]
  );

  const defaultColumns =
    data.board_type === "roadmap"
      ? [
          { title: "Ideas", position: 0, color: "#e0e7ff" },
          { title: "Planned", position: 1, color: "#fef3c7" },
          { title: "In Development", position: 2, color: "#dbeafe" },
          { title: "Released", position: 3, color: "#d1fae5" },
        ]
      : data.board_type === "beta-testing"
      ? [
          { title: "Testing", position: 0, color: "#e0e7ff" },
          { title: "Identified Bugs", position: 1, color: "#fef3c7" },
          { title: "Verified", position: 2, color: "#fed7d7" },
          { title: "Fixing", position: 3, color: "#dbeafe" },
          { title: "Shipped", position: 4, color: "#d1fae5" },
        ]
      : [
          { title: "To Do", position: 0, color: "#e2e8f0" },
          { title: "In Progress", position: 1, color: "#fef3c7" },
          { title: "Done", position: 2, color: "#d1fae5" },
        ];

  for (const col of defaultColumns) {
    await query(
      `INSERT INTO columns (board_id, title, position, color, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [board!.id, col.title, col.position, col.color]
    );
  }

  return c.json(board, 201);
});

app.put("/boards/:id", zValidator("json", UpdateBoardSchema), async (c) => {
  const id = parseInt(c.req.param("id"));
  const data = c.req.valid("json");

  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const set = (col: string, val: unknown) => {
    if (val !== undefined) {
      updates.push(`${col} = $${i++}`);
      values.push(val);
    }
  };
  set("title", data.title);
  set("description", data.description);
  set("color", data.color);
  set("board_type", data.board_type);
  set("is_public", data.is_public);
  set("public_theme", data.public_theme);
  set("invite_mode", data.invite_mode);

  if (updates.length > 0) {
    updates.push(`updated_at = now()`);
    values.push(id);
    await query(`UPDATE boards SET ${updates.join(", ")} WHERE id = $${i}`, values);
  }

  const board = await one<Board>("SELECT * FROM boards WHERE id = $1", [id]);
  return c.json(board);
});

app.delete("/boards/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  // FK ON DELETE CASCADE removes columns/tasks/invitations/categories.
  await query("DELETE FROM boards WHERE id = $1", [id]);
  return c.json({ success: true });
});

/* ----------------------------- Columns ----------------------------- */

app.post("/columns", zValidator("json", CreateColumnSchema), async (c) => {
  const data = c.req.valid("json");
  const column = await one<Column>(
    `INSERT INTO columns (board_id, title, position, color, updated_at)
     VALUES ($1, $2, $3, $4, now()) RETURNING *`,
    [data.board_id, data.title, data.position, data.color ?? null]
  );
  return c.json(column, 201);
});

app.put("/columns/:id", zValidator("json", UpdateColumnSchema), async (c) => {
  const id = parseInt(c.req.param("id"));
  const data = c.req.valid("json");

  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const set = (col: string, val: unknown) => {
    if (val !== undefined) {
      updates.push(`${col} = $${i++}`);
      values.push(val);
    }
  };
  set("title", data.title);
  set("position", data.position);
  set("color", data.color);

  if (updates.length > 0) {
    updates.push(`updated_at = now()`);
    values.push(id);
    await query(`UPDATE columns SET ${updates.join(", ")} WHERE id = $${i}`, values);
  }

  const column = await one<Column>("SELECT * FROM columns WHERE id = $1", [id]);
  return c.json(column);
});

app.delete("/columns/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  await query("DELETE FROM columns WHERE id = $1", [id]);
  return c.json({ success: true });
});

/* ----------------------------- Tasks ----------------------------- */

app.post("/tasks", zValidator("json", CreateTaskSchema), async (c) => {
  const data = c.req.valid("json");
  const task = await one<Task>(
    `INSERT INTO tasks (column_id, title, description, position, priority, due_date, tags, intensity, category, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now()) RETURNING *`,
    [
      data.column_id,
      data.title,
      data.description ?? null,
      data.position,
      data.priority ?? null,
      data.due_date ?? null,
      data.tags ?? null,
      data.intensity ?? 0,
      data.category ?? null,
    ]
  );
  return c.json(task, 201);
});

app.put("/tasks/:id", zValidator("json", UpdateTaskSchema), async (c) => {
  const id = parseInt(c.req.param("id"));
  const data = c.req.valid("json");

  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const set = (col: string, val: unknown) => {
    if (val !== undefined) {
      updates.push(`${col} = $${i++}`);
      values.push(val);
    }
  };
  set("column_id", data.column_id);
  set("title", data.title);
  set("description", data.description);
  set("position", data.position);
  set("priority", data.priority);
  set("due_date", data.due_date);
  set("tags", data.tags);
  set("intensity", data.intensity);
  set("category", data.category);

  if (updates.length > 0) {
    updates.push(`updated_at = now()`);
    values.push(id);
    await query(`UPDATE tasks SET ${updates.join(", ")} WHERE id = $${i}`, values);
  }

  const task = await one<Task>("SELECT * FROM tasks WHERE id = $1", [id]);
  return c.json(task);
});

app.patch("/tasks/:id/move", zValidator("json", MoveTaskSchema), async (c) => {
  const id = parseInt(c.req.param("id"));
  const { column_id, position } = c.req.valid("json");
  const task = await one<Task>(
    `UPDATE tasks SET column_id = $1, position = $2, updated_at = now() WHERE id = $3 RETURNING *`,
    [column_id, position, id]
  );
  return c.json(task);
});

app.delete("/tasks/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  await query("DELETE FROM tasks WHERE id = $1", [id]);
  return c.json({ success: true });
});

/* ----------------------------- Public ----------------------------- */

app.get("/public/:publicKey", async (c) => {
  const publicKey = c.req.param("publicKey");
  const board = await one<Board>(
    "SELECT * FROM boards WHERE public_key = $1 AND is_public = TRUE",
    [publicKey]
  );
  if (!board) return c.json({ error: "Board not found or not public" }, 404);

  const columns = await query<Column>(
    "SELECT * FROM columns WHERE board_id = $1 ORDER BY position",
    [board.id]
  );

  const boardWithColumns: BoardWithColumns = { ...board, columns: [] };
  for (const column of columns) {
    const tasks = await query<Task>(
      "SELECT * FROM tasks WHERE column_id = $1 ORDER BY position",
      [column.id]
    );
    boardWithColumns.columns.push({ ...column, tasks });
  }
  return c.json(boardWithColumns);
});

app.post("/public/:publicKey/tasks/:id/vote", zValidator("json", VoteTaskSchema), async (c) => {
  const publicKey = c.req.param("publicKey");
  const taskId = parseInt(c.req.param("id"));
  const { vote_type } = c.req.valid("json");

  const board = await one<{ id: number }>(
    "SELECT id FROM boards WHERE public_key = $1 AND is_public = TRUE",
    [publicKey]
  );
  if (!board) return c.json({ error: "Board not found or not public" }, 404);

  const column = vote_type === "upvote" ? "upvotes" : "downvotes";
  const task = await one<Task>(
    `UPDATE tasks SET ${column} = ${column} + 1 WHERE id = $1 RETURNING *`,
    [taskId]
  );
  return c.json(task);
});

/* ----------------------------- Invitations ----------------------------- */

app.post("/invitations", zValidator("json", CreateInvitationSchema), async (c) => {
  const data = c.req.valid("json");
  const token = crypto.randomUUID();

  try {
    const board = await one<{ title: string }>("SELECT title FROM boards WHERE id = $1", [data.board_id]);
    if (!board) return c.json({ error: "Board not found" }, 404);

    let columnName: string | null = null;
    if (data.column_id) {
      const column = await one<{ title: string }>("SELECT title FROM columns WHERE id = $1", [data.column_id]);
      columnName = column?.title ?? null;
    }

    const invitation = await one(
      `INSERT INTO invitations (board_id, column_id, email, invited_by, token, updated_at)
       VALUES ($1, $2, $3, $4, $5, now()) RETURNING *`,
      [data.board_id, data.column_id ?? null, data.email, data.invited_by ?? null, token]
    );

    const inviteUrl = `${new URL(c.req.url).origin}/invited/${token}`;

    let emailSent = false;
    let emailError: string | null = null;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (RESEND_API_KEY) {
      try {
        const emailContent = {
          from: "onboarding@resend.dev",
          to: data.email,
          subject: `You're invited to beta test: ${board.title}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="color: #1f2937; margin-bottom: 8px;">Beta Testing Invitation</h1>
                <p style="color: #6b7280; font-size: 16px;">You've been invited to participate in beta testing</p>
              </div>
              <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <h2 style="color: #1f2937; margin-top: 0; margin-bottom: 16px;">${board.title}</h2>
                ${columnName ? `<p style="color: #6b7280; margin-bottom: 16px;">You've been assigned to the <strong>${columnName}</strong> phase.</p>` : ""}
                <p style="color: #6b7280; margin-bottom: 20px;">Help us improve by reporting bugs and providing feedback.</p>
                <div style="text-align: center;">
                  <a href="${inviteUrl}" style="background: #1d1d1f; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; display: inline-block;">Join Beta Testing</a>
                </div>
              </div>
              <div style="text-align: center; color: #9ca3af; font-size: 14px;">
                <p>Or copy this link:</p>
                <p style="word-break: break-all; background: #f3f4f6; padding: 8px; border-radius: 4px; font-family: monospace;">${inviteUrl}</p>
              </div>
            </div>`,
        };

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(emailContent),
        });
        const responseData = (await response.json()) as { message?: string };
        if (response.ok) emailSent = true;
        else emailError = responseData.message || `HTTP ${response.status}`;
      } catch (error) {
        emailError = error instanceof Error ? error.message : "Unknown error";
      }
    } else {
      emailError = "RESEND_API_KEY not configured";
    }

    return c.json(
      {
        success: true,
        invitation,
        emailSent,
        emailError,
        inviteUrl,
        message: emailSent
          ? `Invitation email sent successfully to ${data.email}!`
          : `Invitation created successfully! Share this link manually: ${inviteUrl}`,
      },
      201
    );
  } catch (error) {
    console.error("Database error creating invitation:", error);
    return c.json(
      { error: "Failed to create invitation", details: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});

app.get("/invitations/:boardId", async (c) => {
  const boardId = parseInt(c.req.param("boardId"));
  const invitations = await query(
    "SELECT * FROM invitations WHERE board_id = $1 ORDER BY created_at DESC",
    [boardId]
  );
  return c.json(invitations);
});

/* ----------------------------- Beta categories ----------------------------- */

app.post("/beta-categories", zValidator("json", CreateBetaCategorySchema), async (c) => {
  const data = c.req.valid("json");
  const category = await one(
    `INSERT INTO beta_categories (board_id, name, color, updated_at) VALUES ($1, $2, $3, now()) RETURNING *`,
    [data.board_id, data.name, data.color ?? "#6b7280"]
  );
  return c.json(category, 201);
});

app.get("/beta-categories/:boardId", async (c) => {
  const boardId = parseInt(c.req.param("boardId"));
  const categories = await query(
    "SELECT * FROM beta_categories WHERE board_id = $1 ORDER BY name",
    [boardId]
  );
  return c.json(categories);
});

/* ----------------------------- Invited access ----------------------------- */

app.get("/invited/:token", async (c) => {
  const token = c.req.param("token");
  const invitation = await one<{ board_id: number; column_id: number | null }>(
    "SELECT * FROM invitations WHERE token = $1 AND status = 'pending'",
    [token]
  );
  if (!invitation) return c.json({ error: "Invalid or expired invitation" }, 404);

  const board = await one<Board>("SELECT * FROM boards WHERE id = $1", [invitation.board_id]);
  if (!board) return c.json({ error: "Board not found" }, 404);

  const columns = await query<Column>(
    "SELECT * FROM columns WHERE board_id = $1 ORDER BY position",
    [invitation.board_id]
  );

  const boardWithColumns: BoardWithColumns = { ...board, columns: [] };
  for (const column of columns) {
    const tasks = await query<Task>(
      "SELECT * FROM tasks WHERE column_id = $1 ORDER BY position",
      [column.id]
    );
    boardWithColumns.columns.push({ ...column, tasks });
  }

  return c.json({ board: boardWithColumns, invitation, allowedColumnId: invitation.column_id });
});

export default app;
