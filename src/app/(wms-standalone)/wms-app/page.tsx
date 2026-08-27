'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function WmsAppRoot() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/wms-app/dashboard')
  }, [router])
  return null
}
