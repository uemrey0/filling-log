import type { HTMLAttributes } from 'react'

type SkeletonProps = HTMLAttributes<HTMLDivElement>

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-100 ${className}`}
      {...props}
    />
  )
}
