import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(255, 'Title cannot exceed 255 characters'),
  description: z.string().optional().default(''),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().nullable().optional(),
  completed: z.boolean().optional().default(false),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(255).optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().nullable().optional(),
  completed: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export const updateSettingsSchema = z.object({
  theme: z.string().max(50).optional(),
  reduced_motion: z.boolean().optional(),
  task_reminders_enabled: z.boolean().optional(),
  completion_notifications_enabled: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one setting must be provided for update',
});

export function validate(schema) {
  return (req, res, next) => {
    try {
      req.validatedBody = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(err);
    }
  };
}
