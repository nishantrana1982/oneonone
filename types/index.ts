import { UserRole, MeetingStatus, TodoStatus, TodoPriority } from '@prisma/client'

export type { UserRole, MeetingStatus, TodoStatus, TodoPriority }

export interface User {
  id: string
  email: string
  name: string
  avatar?: string | null
  role: UserRole
  reportsToId?: string | null
  departmentId?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Meeting {
  id: string
  employeeId: string
  reporterId: string
  meetingDate: Date
  checkInPersonal?: string | null
  checkInProfessional?: string | null
  priorityGoalProfessional?: string | null
  priorityGoalAgency?: string | null
  progressReport?: string | null
  goodNews?: string | null
  supportNeeded?: string | null
  priorityDiscussions?: string | null
  headsUp?: string | null
  anythingElse?: string | null
  status: MeetingStatus
  createdAt: Date
  updatedAt: Date
}

export interface Todo {
  id: string
  meetingId?: string | null
  assignedToId: string
  createdById: string
  title: string
  description?: string | null
  dueDate?: Date | null
  priority: TodoPriority
  status: TodoStatus
  completedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}
