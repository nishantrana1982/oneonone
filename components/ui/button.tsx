import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent'
  size?: 'sm' | 'md' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-dark-gray dark:bg-white text-white dark:text-dark-gray hover:bg-charcoal dark:hover:bg-off-white focus:ring-dark-gray dark:focus:ring-white': variant === 'primary',
            'bg-off-white dark:bg-charcoal text-dark-gray dark:text-white border border-light-gray dark:border-medium-gray hover:bg-white dark:hover:bg-charcoal': variant === 'secondary',
            'text-dark-gray dark:text-white hover:bg-off-white dark:hover:bg-dark-gray': variant === 'ghost',
            'bg-orange text-white hover:bg-orange/90 focus:ring-orange': variant === 'accent',
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-base': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
