import type { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'green' | 'red' | 'gray' | 'purple' | 'orange'
}

export function Badge({ variant = 'gray', className = '', children, ...props }: BadgeProps) {
  // Use brand colors where applicable
  const variants = {
    green: 'bg-[#80BC17]/15 text-[#1C7745] border border-[#80BC17]/30',
    red: 'bg-[#E40B17]/10 text-[#E40B17] border border-[#E40B17]/25',
    gray: 'bg-gray-100 text-gray-600 border border-gray-200',
    purple: 'bg-[#544CA9]/10 text-[#544CA9] border border-[#544CA9]/25',
    orange: 'bg-orange-50 text-orange-700 border border-orange-200',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
