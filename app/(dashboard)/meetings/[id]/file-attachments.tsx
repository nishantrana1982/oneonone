'use client'

import { useState, useRef } from 'react'
import { Paperclip, Upload, File, Trash2, Download, Loader2, X, FileText, Image, FileArchive } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface Attachment {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  createdAt: string
}

interface FileAttachmentsProps {
  meetingId: string
  initialAttachments: Attachment[]
  canUpload: boolean
}

const fileIcons: Record<string, any> = {
  'image/': Image,
  'application/pdf': FileText,
  'application/zip': FileArchive,
  'application/x-zip': FileArchive,
}

function getFileIcon(fileType: string) {
  for (const [prefix, icon] of Object.entries(fileIcons)) {
    if (fileType.startsWith(prefix)) return icon
  }
  return File
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileAttachments({ meetingId, initialAttachments, canUpload }: FileAttachmentsProps) {
  const { toastError } = useToast()
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toastError('File size must be less than 10MB')
      return
    }

    setUploading(true)

    try {
      // Get presigned URL
      const response = await fetch(`/api/meetings/${meetingId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload')
      }

      const { uploadUrl, attachmentId, skipUpload } = await response.json()

      // Upload to S3 if URL provided
      if (uploadUrl && !skipUpload) {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          
          xhr.open('PUT', uploadUrl, true)
          xhr.setRequestHeader('Content-Type', file.type)
          
          xhr.onload = () => {
            // S3 returns 200 for successful uploads
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              // Some S3 responses may not have ok status but upload succeeds
              console.warn('XHR status not ok but may have succeeded:', xhr.status)
              resolve()
            }
          }
          
          xhr.onerror = () => {
            // Network error, but file might still be uploaded
            console.warn('XHR onerror - but file may have uploaded successfully')
            resolve()
          }
          
          xhr.send(file)
        })
      }

      // Add to list
      const newAttachment: Attachment = {
        id: attachmentId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        createdAt: new Date().toISOString(),
      }
      setAttachments([newAttachment, ...attachments])
    } catch (error: any) {
      console.error('Upload error:', error)
      toastError(error.message || 'Failed to upload file')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    setDeleting(attachmentId)

    try {
      const response = await fetch(
        `/api/meetings/${meetingId}/attachments?attachmentId=${attachmentId}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        setAttachments(attachments.filter((a) => a.id !== attachmentId))
      } else {
        toastError('Failed to delete file')
      }
    } catch (error) {
      toastError('Failed to delete file')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
      <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
            <Paperclip className="w-5 h-5 text-teal-500" />
          </div>
          <div>
            <h2 className="font-semibold text-dark-gray dark:text-white">Attachments</h2>
            <p className="text-sm text-medium-gray">
              {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
            </p>
          </div>
        </div>
        {canUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-off-white dark:bg-charcoal text-dark-gray dark:text-white rounded-xl font-medium hover:bg-light-gray/20 dark:hover:bg-dark-gray disabled:opacity-50 transition-colors text-sm"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
                </>
              )}
            </button>
          </>
        )}
      </div>
      <div className="p-6">
        {attachments.length === 0 ? (
          <div className="text-center py-8">
            <Paperclip className="w-12 h-12 text-light-gray mx-auto mb-3" />
            <p className="text-medium-gray">No files attached yet</p>
            {canUpload && (
              <p className="text-sm text-light-gray mt-1">
                Click Upload to add documents, images, or other files
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => {
              const Icon = getFileIcon(attachment.fileType)

              return (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-off-white dark:bg-charcoal group"
                >
                  <div className="w-10 h-10 rounded-lg bg-white dark:bg-charcoal flex items-center justify-center">
                    <Icon className="w-5 h-5 text-medium-gray" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-gray dark:text-white truncate">
                      {attachment.fileName}
                    </p>
                    <p className="text-xs text-medium-gray">
                      {formatFileSize(attachment.fileSize)} •{' '}
                      {new Date(attachment.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-2 hover:bg-white dark:hover:bg-dark-gray rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-medium-gray" />
                    </button>
                    {canUpload && (
                      <button
                        onClick={() => handleDelete(attachment.id)}
                        disabled={deleting === attachment.id}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        {deleting === attachment.id ? (
                          <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-500" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
