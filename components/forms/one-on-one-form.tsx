'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const formSchema = z.object({
  checkInPersonal: z.string().optional(),
  checkInProfessional: z.string().optional(),
  priorityGoalProfessional: z.string().optional(),
  priorityGoalAgency: z.string().optional(),
  progressReport: z.string().optional(),
  goodNews: z.string().optional(),
  supportNeeded: z.string().optional(),
  priorityDiscussions: z.string().optional(),
  headsUp: z.string().optional(),
  anythingElse: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface OneOnOneFormProps {
  onSubmit: (data: FormData) => Promise<void>
  onSaveDraft?: (data: FormData) => Promise<void>
  initialData?: Partial<FormData>
  isLoading?: boolean
  isReadOnly?: boolean
  draftSaved?: boolean
}

export function OneOnOneForm({
  onSubmit,
  onSaveDraft,
  initialData,
  isLoading,
  isReadOnly = false,
  draftSaved = false,
}: OneOnOneFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData,
  })

  const inputClass = isReadOnly
    ? 'w-full rounded-xl border border-light-gray dark:border-medium-gray bg-gray-100 dark:bg-charcoal/80 px-4 py-3 text-dark-gray dark:text-white cursor-not-allowed'
    : 'w-full rounded-xl border border-light-gray dark:border-medium-gray bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white placeholder:text-medium-gray focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20 transition-colors'

  return (
    <form
      onSubmit={isReadOnly ? (e) => e.preventDefault() : handleSubmit(onSubmit)}
      className="space-y-8"
    >
      {/* Page 1 */}
      <Card>
        <CardHeader>
          <CardTitle>Check-In</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Personal best since we last met
            </label>
            <textarea
              {...register('checkInPersonal')}
              rows={4}
              className={inputClass}
              placeholder="Share your personal highlights..."
              disabled={isReadOnly}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Professional best since we last met
            </label>
            <textarea
              {...register('checkInProfessional')}
              rows={4}
              className={inputClass}
              placeholder="Share your professional highlights..."
              disabled={isReadOnly}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Priority Issues / Growth Goals for This Quarter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              To serve your professional growth
            </label>
            <textarea
              {...register('priorityGoalProfessional')}
              rows={4}
              className={inputClass}
              placeholder="What are your professional growth goals for this quarter?"
              disabled={isReadOnly}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              To serve the agency growth
            </label>
            <textarea
              {...register('priorityGoalAgency')}
              rows={4}
              className={inputClass}
              placeholder="What are your goals to help the agency grow?"
              disabled={isReadOnly}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Report on progress of these issues/goals
            </label>
            <textarea
              {...register('progressReport')}
              rows={5}
              className={inputClass}
              placeholder="How are you progressing on these goals?"
              disabled={isReadOnly}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Good News</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Good news to report
            </label>
            <textarea
              {...register('goodNews')}
              rows={4}
              className={inputClass}
              placeholder="Share any good news or wins..."
              disabled={isReadOnly}
            />
          </div>
        </CardContent>
      </Card>

      {/* Page 2 */}
      <Card>
        <CardHeader>
          <CardTitle>Support & Discussion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Support I need to do my job
            </label>
            <textarea
              {...register('supportNeeded')}
              rows={4}
              className={inputClass}
              placeholder="What support or resources do you need?"
              disabled={isReadOnly}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Priority issues to discuss / questions that need answers / input
            </label>
            <textarea
              {...register('priorityDiscussions')}
              rows={4}
              className={inputClass}
              placeholder="What topics would you like to discuss?"
              disabled={isReadOnly}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Heads Up</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Client or internal issues
            </label>
            <textarea
              {...register('headsUp')}
              rows={4}
              className={inputClass}
              placeholder="Any issues or concerns to flag?"
              disabled={isReadOnly}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Anything else?
            </label>
            <textarea
              {...register('anythingElse')}
              rows={4}
              className={inputClass}
              placeholder="Any other thoughts or comments?"
              disabled={isReadOnly}
            />
          </div>
        </CardContent>
      </Card>

      {!isReadOnly && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {draftSaved && (
            <span className="text-sm text-green-600 dark:text-green-400">Draft saved. You can finish later.</span>
          )}
          {onSaveDraft && (
            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => void handleSubmit(onSaveDraft)()}
            >
              {isLoading ? 'Saving...' : 'Save draft'}
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Submitting...' : 'Submit Form'}
          </Button>
        </div>
      )}
    </form>
  )
}
