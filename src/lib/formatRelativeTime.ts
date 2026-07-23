import type { Timestamp } from 'firebase/firestore'

export function formatRelativeTime(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return '방금 전'
  const minutes = Math.floor((Date.now() - timestamp.toMillis()) / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}
