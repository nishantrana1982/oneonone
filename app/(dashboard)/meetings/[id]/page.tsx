import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { canAccessEmployeeData } from '@/lib/auth-helpers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Calendar, User, FileText, CheckSquare, Clock, ArrowLeft, Mic } from 'lucide-react'
import { UserRole } from '@prisma/client'
import { AddTodoForm } from './add-todo-form'
import { MeetingRecorder } from './meeting-recorder'
import { TranscriptViewer } from './transcript-viewer'
import { MeetingNotes } from './meeting-notes'
import { FileAttachments } from './file-attachments'

export default async function MeetingDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getCurrentUser()
  if (!user) return notFound()

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      employee: true,
      reporter: true,
      recording: true,
      attachments: {
        orderBy: { createdAt: 'desc' },
      },
      todos: {
        include: {
          assignedTo: { select: { name: true, email: true } },
          createdBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!meeting) return notFound()

  const canAccess = canAccessEmployeeData(
    user.role,
    user.id,
    meeting.employeeId,
    meeting.employee.reportsToId
  )

  if (!canAccess) return notFound()

  const isReporter = user.role === UserRole.REPORTER || user.role === UserRole.SUPER_ADMIN
  const isEmployee = user.id === meeting.employeeId
  const meetingDate = new Date(meeting.meetingDate)
  const isPast = meetingDate < new Date()
  const hasFormData = meeting.checkInPersonal || meeting.checkInProfessional

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formSections = [
    { title: 'Check-In: Personal Best', content: meeting.checkInPersonal },
    { title: 'Check-In: Professional Best', content: meeting.checkInProfessional },
    { title: 'Priority Goal: Professional Growth', content: meeting.priorityGoalProfessional },
    { title: 'Priority Goal: Agency Growth', content: meeting.priorityGoalAgency },
    { title: 'Progress Report', content: meeting.progressReport },
    { title: 'Good News', content: meeting.goodNews },
    { title: 'Support Needed', content: meeting.supportNeeded },
    { title: 'Priority Discussions', content: meeting.priorityDiscussions },
    { title: 'Heads Up', content: meeting.headsUp },
    { title: 'Anything Else', content: meeting.anythingElse },
  ].filter(section => section.content)

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Back Button */}
      <Link
        href="/meetings"
        className="inline-flex items-center gap-2 text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to meetings
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-dark-gray dark:text-white mb-2">
            One-on-One Meeting
          </h1>
          <p className="text-medium-gray flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {formatDate(meetingDate)}
          </p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-medium ${
          meeting.status === 'COMPLETED'
            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
        }`}>
          {meeting.status === 'COMPLETED' ? 'Completed' : isPast ? 'Pending Form' : 'Scheduled'}
        </span>
      </div>

      {/* Participants */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <User className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-medium-gray">Employee</p>
              <p className="font-medium text-dark-gray dark:text-white">{meeting.employee.name || meeting.employee.email}</p>
              <p className="text-sm text-medium-gray">{meeting.employee.email}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <User className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-medium-gray">Reporter</p>
              <p className="font-medium text-dark-gray dark:text-white">{meeting.reporter.name || meeting.reporter.email}</p>
              <p className="text-sm text-medium-gray">{meeting.reporter.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recording Section - Only for Reporters and Super Admins */}
      {isReporter && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-dark-gray dark:text-white flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Meeting Recording
          </h2>
          
          <MeetingRecorder
            meetingId={meeting.id}
            hasExistingRecording={!!meeting.recording}
            recordingStatus={meeting.recording?.status}
            errorMessage={meeting.recording?.errorMessage}
          />

          {/* Transcript Viewer */}
          {meeting.recording && meeting.recording.status === 'COMPLETED' && (
            <TranscriptViewer
              recording={{
                id: meeting.recording.id,
                meetingId: meeting.recording.meetingId,
                transcript: meeting.recording.transcript,
                language: meeting.recording.language,
                summary: meeting.recording.summary,
                keyPoints: meeting.recording.keyPoints as string[] | null,
                autoTodos: meeting.recording.autoTodos as any,
                sentiment: meeting.recording.sentiment as any,
                qualityScore: meeting.recording.qualityScore,
                qualityDetails: meeting.recording.qualityDetails as any,
                duration: meeting.recording.duration,
                audioPlaybackUrl: null, // Will be fetched client-side with signed URL
              }}
            />
          )}
        </div>
      )}

      {/* Meeting Notes */}
      <MeetingNotes
        meetingId={meeting.id}
        initialNotes={meeting.notes}
        canEdit={isReporter}
      />

      {/* File Attachments */}
      <FileAttachments
        meetingId={meeting.id}
        initialAttachments={meeting.attachments.map(a => ({
          id: a.id,
          fileName: a.fileName,
          fileType: a.fileType,
          fileSize: a.fileSize,
          createdAt: a.createdAt.toISOString(),
        }))}
        canUpload={isReporter || isEmployee}
      />

      {/* Action Button */}
      {meeting.status === 'SCHEDULED' && isEmployee && isPast && (
        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="font-medium text-dark-gray dark:text-white">Form Required</p>
                <p className="text-sm text-medium-gray">Please fill out the one-on-one form for this meeting</p>
              </div>
            </div>
            <Link
              href={`/meetings/${meeting.id}/form`}
              className="px-5 py-2.5 bg-dark-gray dark:bg-white text-white dark:text-dark-gray rounded-xl font-medium hover:bg-charcoal dark:hover:bg-off-white transition-colors"
            >
              Fill Form
            </Link>
          </div>
        </div>
      )}

      {/* Form Responses */}
      {hasFormData && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-dark-gray dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Form Responses
          </h2>
          <div className="space-y-4">
            {formSections.map((section, index) => (
              <div
                key={index}
                className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-6"
              >
                <h3 className="font-medium text-dark-gray dark:text-white mb-3">{section.title}</h3>
                <p className="text-medium-gray whitespace-pre-wrap">{section.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-dark-gray dark:text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5" />
            Tasks from this Meeting
          </h2>
          {isReporter && (
            <AddTodoForm
              meetingId={meeting.id}
              employeeId={meeting.employeeId}
              employeeName={meeting.employee.name || meeting.employee.email}
              reporterId={meeting.reporterId}
              reporterName={meeting.reporter.name || meeting.reporter.email}
            />
          )}
        </div>

        {meeting.todos.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-8 text-center">
            <CheckSquare className="w-12 h-12 text-light-gray mx-auto mb-3" />
            <p className="text-medium-gray">No tasks created for this meeting yet</p>
            {isReporter && (
              <p className="text-sm text-light-gray mt-1">Click Add Task to create action items</p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
            <div className="divide-y divide-off-white dark:divide-medium-gray/20">
              {meeting.todos.map((todo) => (
                <div key={todo.id} className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      todo.status === 'DONE'
                        ? 'bg-green-500/10'
                        : todo.status === 'IN_PROGRESS'
                        ? 'bg-blue-500/10'
                        : 'bg-gray-500/10'
                    }`}>
                      {todo.status === 'DONE' ? (
                        <CheckSquare className="w-5 h-5 text-green-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className={`font-medium ${
                            todo.status === 'DONE'
                              ? 'text-medium-gray line-through'
                              : 'text-dark-gray dark:text-white'
                          }`}>
                            {todo.title}
                          </p>
                          {todo.description && (
                            <p className="text-sm text-medium-gray mt-1">{todo.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-medium-gray">
                            <span>Assigned to: {todo.assignedTo.name || todo.assignedTo.email}</span>
                            {todo.dueDate && (
                              <span>Due: {new Date(todo.dueDate).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            todo.priority === 'HIGH'
                              ? 'bg-red-500/10 text-red-500'
                              : todo.priority === 'MEDIUM'
                              ? 'bg-orange/10 text-orange'
                              : 'bg-gray-500/10 text-gray-500'
                          }`}>
                            {todo.priority}
                          </span>
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            todo.status === 'DONE'
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : todo.status === 'IN_PROGRESS'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                          }`}>
                            {todo.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
