import { prisma } from './prisma'
import { NotificationType } from '@prisma/client'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  data?: any
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
      data: params.data,
    },
  })
}

export async function createNotificationForUsers(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
) {
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
      data: params.data,
    })),
  })
}

export async function getUnreadNotifications(userId: string) {
  return prisma.notification.findMany({
    where: {
      userId,
      isRead: false,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function getAllNotifications(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: { isRead: true },
  })
}

export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: { isRead: true },
  })
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  })
}

export async function getFilteredNotifications(
  userId: string,
  options: {
    type?: string
    isRead?: boolean
    limit?: number
    offset?: number
  } = {}
) {
  const where: any = { userId }
  if (options.type) where.type = options.type
  if (options.isRead !== undefined) where.isRead = options.isRead

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    }),
    prisma.notification.count({ where }),
  ])

  return { notifications, total }
}

export async function deleteNotification(notificationId: string, userId: string) {
  return prisma.notification.deleteMany({
    where: {
      id: notificationId,
      userId,
    },
  })
}

export async function deleteAllReadNotifications(userId: string) {
  return prisma.notification.deleteMany({
    where: {
      userId,
      isRead: true,
    },
  })
}

export async function deleteAllNotifications(userId: string) {
  return prisma.notification.deleteMany({
    where: { userId },
  })
}

// Helper functions for common notification types
export async function notifyMeetingScheduled(
  employeeId: string,
  reporterName: string,
  meetingDate: Date,
  meetingId: string
) {
  return createNotification({
    userId: employeeId,
    type: 'MEETING_SCHEDULED',
    title: 'New Meeting Scheduled',
    message: `${reporterName} has scheduled a one-on-one meeting with you on ${meetingDate.toLocaleDateString()}`,
    link: `/meetings/${meetingId}`,
  })
}

export async function notifyMeetingReminder(
  userId: string,
  otherPersonName: string,
  meetingDate: Date,
  meetingId: string,
  hoursUntil: number
) {
  return createNotification({
    userId,
    type: 'MEETING_REMINDER',
    title: 'Meeting Reminder',
    message: `Your one-on-one with ${otherPersonName} is in ${hoursUntil} hours`,
    link: `/meetings/${meetingId}`,
  })
}

export async function notifyTodoAssigned(
  userId: string,
  creatorName: string,
  todoTitle: string,
  todoId: string
) {
  return createNotification({
    userId,
    type: 'TODO_ASSIGNED',
    title: 'New Task Assigned',
    message: `${creatorName} assigned you a task: "${todoTitle}"`,
    link: `/todos`,
  })
}

export async function notifyFormSubmitted(
  reporterId: string,
  employeeName: string,
  meetingId: string
) {
  return createNotification({
    userId: reporterId,
    type: 'FORM_SUBMITTED',
    title: 'Form Submitted',
    message: `${employeeName} has submitted their one-on-one form`,
    link: `/meetings/${meetingId}`,
  })
}

export async function notifyRecordingReady(
  userIds: string[],
  meetingId: string
) {
  return createNotificationForUsers(userIds, {
    type: 'RECORDING_READY',
    title: 'Recording Ready',
    message: 'Meeting recording has been processed and is ready to view',
    link: `/meetings/${meetingId}`,
  })
}

export async function notifyMeetingCancelled(
  userId: string,
  cancelledByName: string,
  meetingDate: Date,
  meetingId: string
) {
  return createNotification({
    userId,
    type: 'MEETING_CANCELLED',
    title: 'Meeting Cancelled',
    message: `${cancelledByName} cancelled the one-on-one meeting scheduled for ${meetingDate.toLocaleDateString()}`,
    link: `/meetings/${meetingId}`,
  })
}

export async function notifyMeetingCompleted(
  employeeId: string,
  reporterName: string,
  meetingId: string
) {
  return createNotification({
    userId: employeeId,
    type: 'MEETING_SCHEDULED',
    title: 'Meeting Completed',
    message: `${reporterName} has marked your one-on-one meeting as completed`,
    link: `/meetings/${meetingId}`,
  })
}

export async function notifyTodoDueSoon(
  userId: string,
  todoTitle: string,
  dueDate: Date
) {
  return createNotification({
    userId,
    type: 'TODO_DUE_SOON',
    title: 'Task Due Soon',
    message: `Your task "${todoTitle}" is due on ${dueDate.toLocaleDateString()}`,
    link: `/todos`,
  })
}

export async function notifyTodoOverdue(
  userId: string,
  todoTitle: string
) {
  return createNotification({
    userId,
    type: 'TODO_OVERDUE',
    title: 'Task Overdue',
    message: `Your task "${todoTitle}" is past its due date`,
    link: `/todos`,
  })
}
