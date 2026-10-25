import { Router } from 'express';
import { query } from '../db/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, createTaskSchema, updateTaskSchema } from '../middleware/validation.js';

const router = Router();

// All task routes require authentication
router.use(requireAuth);

function formatTask(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || '',
    completed: row.completed,
    priority: row.priority,
    dueDate: row.due_date ? new Date(row.due_date).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

// GET /api/tasks - List tasks for the authenticated user
router.get('/', async (req, res, next) => {
  try {
    const { filter, search, priority } = req.query;
    const conditions = ['user_id = $1'];
    const params = [req.userId];
    let paramIndex = 2;

    if (filter === 'completed') {
      conditions.push(`completed = TRUE`);
    } else if (filter === 'active') {
      conditions.push(`completed = FALSE`);
    }

    if (priority && ['low', 'medium', 'high'].includes(priority.toLowerCase())) {
      conditions.push(`priority = $${paramIndex}`);
      params.push(priority.toLowerCase());
      paramIndex++;
    }

    if (search && search.trim()) {
      conditions.push(`title ILIKE $${paramIndex}`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const sql = `
      SELECT id, user_id, title, description, completed, priority, due_date, created_at, updated_at
      FROM tasks
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
    `;

    const result = await query(sql, params);
    const tasks = result.rows.map(formatTask);

    return res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks - Create a new task
router.post('/', validate(createTaskSchema), async (req, res, next) => {
  try {
    const { title, description, priority, dueDate, completed } = req.validatedBody;

    const result = await query(
      `INSERT INTO tasks (user_id, title, description, priority, due_date, completed)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, title, description, completed, priority, due_date, created_at, updated_at`,
      [req.userId, title, description, priority, dueDate || null, completed]
    );

    const task = formatTask(result.rows[0]);
    return res.status(201).json({
      message: 'Task created successfully',
      task,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id - Get a specific task by id (enforces ownership)
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, user_id, title, description, completed, priority, due_date, created_at, updated_at
       FROM tasks
       WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found or access denied',
      });
    }

    return res.json({ task: formatTask(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id - Update an existing task (enforces ownership)
router.patch('/:id', validate(updateTaskSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.validatedBody;

    const setClauses = [];
    const params = [id, req.userId];
    let paramIndex = 3;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex}`);
      params.push(updates.title);
      paramIndex++;
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      params.push(updates.description);
      paramIndex++;
    }

    if (updates.completed !== undefined) {
      setClauses.push(`completed = $${paramIndex}`);
      params.push(updates.completed);
      paramIndex++;
    }

    if (updates.priority !== undefined) {
      setClauses.push(`priority = $${paramIndex}`);
      params.push(updates.priority);
      paramIndex++;
    }

    if (updates.dueDate !== undefined) {
      setClauses.push(`due_date = $${paramIndex}`);
      params.push(updates.dueDate);
      paramIndex++;
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    const sql = `
      UPDATE tasks
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, title, description, completed, priority, due_date, created_at, updated_at
    `;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found or access denied',
      });
    }

    return res.json({
      message: 'Task updated successfully',
      task: formatTask(result.rows[0]),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id - Delete a task (enforces ownership)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `DELETE FROM tasks
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found or access denied',
      });
    }

    return res.json({
      message: 'Task deleted successfully',
      id: result.rows[0].id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
