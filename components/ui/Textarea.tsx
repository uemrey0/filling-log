import { type TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-gray-900">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={3}
          className={`w-full rounded-lg border px-4 py-3 text-base md:text-sm text-gray-900 placeholder-gray-400 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none ${
            error ? 'border-accent-red ring-1 ring-accent-red' : 'border-gray-300'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-accent-red font-medium">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
