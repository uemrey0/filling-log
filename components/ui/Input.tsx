import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-900">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border px-4 py-3 text-base md:text-sm text-gray-900 placeholder-gray-400 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
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

Input.displayName = 'Input'
