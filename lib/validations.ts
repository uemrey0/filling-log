import { z } from 'zod/v4'
import { DEPARTMENT_KEYS } from './departments'

export const personnelSchema = z.object({
  fullName: z.string().min(1).max(255),
  isActive: z.boolean().optional().default(true),
  notes: z.string().max(1000).optional().nullable(),
})

const resolutionSchema = z.object({
  taskId: z.string().uuid(),
  isDone: z.boolean(),
  remainingColli: z.number().int().min(1).optional(),
})

export const startTaskSchema = z.object({
  personnelIds: z.array(z.string().uuid()).min(1),
  department: z.enum(DEPARTMENT_KEYS),
  colliCount: z.number().int().min(1).max(9999),
  notes: z.string().max(1000).optional().nullable(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  resolutions: z.array(resolutionSchema).optional().default([]),
})

export const endSessionSchema = z.object({
  endedAt: z.string().datetime().optional(),
})

export type PersonnelInput = z.infer<typeof personnelSchema>
export type StartTaskInput = z.infer<typeof startTaskSchema>
export type EndSessionInput = z.infer<typeof endSessionSchema>
export type TaskResolution = z.infer<typeof resolutionSchema>
export { resolutionSchema }
