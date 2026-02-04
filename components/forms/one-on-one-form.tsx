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
  initialData?: Partial<FormData>
  isLoading?: boolean
}

export function OneOnOneForm({ onSubmit, initialData, isLoading }: OneOnOneFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
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
              className="w-full rounded-xl border border-light-gray dark:border-medium-gray bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white placeholder:text-medium-gray focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20 transition-colors"
              placeholder="Share your personal highlights..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Professional best since we last met
            </label>
            <textarea
              {...register('checkInProfessional')}
              rows={4}
              className="w-full rounded-xl border border-light-gray dark:border-medium-gray bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white placeholder:text-medium-gray focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20 transition-colors"
              placeholder="Share your professional highlights..."
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
              className="w-full rounded-xl border border-light-gray dark:border-medium-gray bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white placeholder:text-medium-gray focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20 transition-colors"
              placeholder="What are your professional growth goals for this quarter?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              To serve the agency growth
            </label>
            <textarea
              {...register('priorityGoalAgency')}
              rows={4}
              className="w-full rounded-xl border border-light-gray dark:border-medium-gray bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white placeholder:text-medium-gray focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20 transition-colors"
              placeholder="What are your goals to help the agency grow?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Report on progress of these issues/goals
            </label>
            <textarea
              {...register('progressReport')}
              rows={5}
              className="w-full rounded-xl border border-light-gray dark:border-medium-gray bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white placeholder:text-medium-gray focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20 transition-colors"
              placeholder="How are you progressing on these goals?"
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
              className="w-full rounded-xl border border-light-gray dark:border-medium-gray bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white placeholder:text-medium-gray focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20 transition-colors"
              placeholder="Share any good news or wins..."
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
              className="w-full rounded-xl border border-light-gray dark:border-medium-gray bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white placeholder:text-medium-gray focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20 transition-colors"
              placeholder="What support or resources do you need?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray dark:text-white mb-2">
              Priority issues to discuss / questions that need answers / input
            </label>
            <textarea
              {...register('priorityDiscussions')}
              rows={4}
              className="w-full rounded-xl border border-light-gray dark:border-medium-gray bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white placeholder:text-medium-gray focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20 transition-colors"
              placeholder="What topics would you like to discuss?"
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
              className="w-full rounded-xl border border-light-gray dark:border-medium-gray bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white placeholder:text-medium-gray focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20 transition-colors"
              placeholder="Any issues or concerns to flag?"
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
              className="w-full rounded-xl border border-light-gray dark:border-medium-gray bg-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white placeholder:text-medium-gray focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20 transition-colors"
              placeholder="Any other thoughts or comments?"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" variant="primary" disabled={isLoading}>
          {isLoading ? 'Submitting...' : 'Submit Form'}
        </Button>
      </div>
    </form>
  )
}
