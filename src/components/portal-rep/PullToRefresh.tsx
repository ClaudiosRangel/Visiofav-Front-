'use client'

import { useRef, useState, useCallback, type ReactNode } from 'react'
import { Loader, Box } from '@mantine/core'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
}

const THRESHOLD = 60

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)

  const touchStartY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isRefreshing) return
      const scrollTop = containerRef.current?.scrollTop ?? 0
      if (scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY
      }
    },
    [isRefreshing],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isRefreshing) return
      if (touchStartY.current === 0) return

      const scrollTop = containerRef.current?.scrollTop ?? 0
      if (scrollTop > 0) {
        touchStartY.current = 0
        setPullDistance(0)
        return
      }

      const currentY = e.touches[0].clientY
      const distance = currentY - touchStartY.current

      if (distance > 0) {
        // Apply resistance — pull distance diminishes as you pull further
        const dampened = Math.min(distance * 0.5, 120)
        setPullDistance(dampened)
      }
    },
    [isRefreshing],
  )

  const handleTouchEnd = useCallback(async () => {
    if (isRefreshing) return
    if (pullDistance >= THRESHOLD) {
      setIsRefreshing(true)
      setPullDistance(THRESHOLD * 0.5)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
    touchStartY.current = 0
  }, [isRefreshing, pullDistance, onRefresh])

  return (
    <Box
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative', overflow: 'auto', height: '100%' }}
    >
      {/* Indicador visual de pull-to-refresh */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: pullDistance > 0 ? `${pullDistance}px` : '0px',
          overflow: 'hidden',
          transition: isRefreshing ? 'none' : 'height 0.2s ease',
          zIndex: 10,
        }}
      >
        {(pullDistance >= THRESHOLD || isRefreshing) && (
          <Loader size="sm" color="green" />
        )}
      </Box>

      {/* Conteúdo deslocado para baixo conforme o pull */}
      <Box
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: isRefreshing ? 'none' : 'transform 0.2s ease',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
