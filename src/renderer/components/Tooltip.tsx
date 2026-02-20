import { useState, useRef, useCallback, cloneElement } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  text: string
  children: React.ReactElement
  delay?: number
  placement?: 'top' | 'bottom' | 'right'
}

export default function Tooltip({ text, children, delay = 150, placement = 'top' }: Props) {
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      setRect(e.currentTarget.getBoundingClientRect())
      timerRef.current = setTimeout(() => setVisible(true), delay)
    },
    [delay]
  )

  const handleMouseLeave = useCallback(() => {
    clearTimeout(timerRef.current)
    setVisible(false)
  }, [])

  const style: React.CSSProperties = rect
    ? placement === 'right'
      ? {
          position: 'fixed',
          left: rect.right + 6,
          top: rect.top + rect.height / 2,
          transform: 'translateY(-50%)',
          zIndex: 9999,
          pointerEvents: 'none',
        }
      : placement === 'bottom'
        ? {
            position: 'fixed',
            left: rect.left + rect.width / 2,
            top: rect.bottom + 6,
            transform: 'translateX(-50%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }
        : {
            position: 'fixed',
            left: rect.left + rect.width / 2,
            top: rect.top - 6,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }
    : { display: 'none' }

  return (
    <>
      {cloneElement(children, { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave })}
      {visible && rect &&
        createPortal(
          <div
            style={style}
            className="w-max rounded-md bg-gray-900 px-2.5 py-1 text-xs text-white shadow-lg dark:bg-gray-700"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  )
}
