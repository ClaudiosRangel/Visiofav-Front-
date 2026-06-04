'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PcpPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/pcp/dashboard') }, [router])
  return null
}
