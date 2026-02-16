import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import {
  getFilteredNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  deleteAllReadNotifications,
  deleteAllNotifications,
} from '@/lib/notifications'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') || undefined
    const readFilter = searchParams.get('read')
    const countOnly = searchParams.get('countOnly') === 'true'

    if (countOnly) {
      const count = await getUnreadCount(user.id)
      return NextResponse.json({ count })
    }

    const isRead = readFilter === 'true' ? true : readFilter === 'false' ? false : undefined

    const { notifications, total } = await getFilteredNotifications(user.id, {
      type,
      isRead,
      limit,
      offset,
    })
    const unreadCount = await getUnreadCount(user.id)

    return NextResponse.json({ notifications, unreadCount, total })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'markAllRead') {
      await markAllNotificationsAsRead(user.id)
      return NextResponse.json({ success: true })
    }

    if (action === 'deleteAllRead') {
      const result = await deleteAllReadNotifications(user.id)
      return NextResponse.json({ success: true, deleted: result.count })
    }

    if (action === 'deleteAll') {
      const result = await deleteAllNotifications(user.id)
      return NextResponse.json({ success: true, deleted: result.count })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating notifications:', error)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}
