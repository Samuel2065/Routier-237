import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toaster } from '@/components/common/toaster'
import { getToasts, toast, TOAST_DURATIONS, TOAST_EXIT_MS } from '@/lib/toast'

function countdownBar(): HTMLElement {
  return screen.getByRole('status').querySelector('[aria-hidden="true"].origin-left') as HTMLElement
}

describe('Toaster', () => {
  beforeEach(() => vi.useFakeTimers())

  afterEach(() => {
    act(() => getToasts().forEach((item) => toast.dismiss(item.id)))
    act(() => vi.advanceTimersByTime(TOAST_EXIT_MS))
    vi.useRealTimers()
  })

  it('shows a toast with its countdown bar, then closes it with an exit animation', () => {
    render(<Toaster />)
    act(() => {
      toast.success('Trajet publié.')
    })

    expect(screen.getByText('Trajet publié.')).toBeInTheDocument()
    expect(countdownBar().style.animation).toContain(`${TOAST_DURATIONS.success}ms`)

    // Fin du compte à rebours : animation de sortie, puis retrait.
    act(() => vi.advanceTimersByTime(TOAST_DURATIONS.success))
    expect(screen.getByRole('status').className).toContain('toast-out')
    act(() => vi.advanceTimersByTime(TOAST_EXIT_MS))
    expect(screen.queryByText('Trajet publié.')).not.toBeInTheDocument()
  })

  it('pauses the countdown while the pointer is on the toast', () => {
    render(<Toaster />)
    act(() => {
      toast.error('Paiement refusé.')
    })

    fireEvent.mouseEnter(screen.getByRole('alert'))
    expect((screen.getByRole('alert').querySelector('.origin-left') as HTMLElement).style.animationPlayState).toBe('paused')
    act(() => vi.advanceTimersByTime(TOAST_DURATIONS.error * 2))
    expect(screen.getByText('Paiement refusé.')).toBeInTheDocument()

    fireEvent.mouseLeave(screen.getByRole('alert'))
    act(() => vi.advanceTimersByTime(TOAST_DURATIONS.error + TOAST_EXIT_MS))
    expect(screen.queryByText('Paiement refusé.')).not.toBeInTheDocument()
  })

  it('closes on the close button and never doubles a toast with the same id', () => {
    render(<Toaster />)
    act(() => {
      toast('Nouvelle réservation', { id: 'notification-1', description: 'R237-1' })
      toast('Nouvelle réservation', { id: 'notification-1', description: 'R237-1' })
      toast.success('Enregistré.')
      toast.success('Enregistré.')
    })

    expect(screen.getAllByText('Nouvelle réservation')).toHaveLength(1)
    expect(screen.getAllByText('Enregistré.')).toHaveLength(1)

    fireEvent.click(screen.getAllByRole('button', { name: 'Fermer la notification' })[0])
    act(() => vi.advanceTimersByTime(TOAST_EXIT_MS))
    expect(screen.queryByText('Nouvelle réservation')).not.toBeInTheDocument()
  })
})
