import { useRef } from 'react'
import { motion, useReducedMotion, useMotionValue, useSpring } from 'motion/react'

// Shared easing for the Paper Trail language (soft, printed settle).
export const EASE = [0.22, 1, 0.36, 1]

// Scroll-reveal: fades + rises into place once, respects reduced motion.
export function Reveal({ children, delay = 0, y = 24, className = '', as = 'div', once = true }) {
  const reduce = useReducedMotion()
  const M = motion[as] || motion.div
  return (
    <M
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-90px' }}
      transition={{ duration: 0.75, delay, ease: EASE }}>
      {children}
    </M>
  )
}

// Staggered container + item for grids/lists.
export function StaggerGroup({ children, className = '', stagger = 0.08 }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}>
      {children}
    </motion.div>
  )
}

export const staggerItem = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

// Magnetic button — pointer pull via motion values (no re-render), spring return.
export function MagneticButton({ children, onClick, className = '', style, ariaLabel, strength = 0.28, type = 'button' }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.2 })
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.2 })
  function move(e) {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - r.left - r.width / 2) * strength)
    y.set((e.clientY - r.top - r.height / 2) * strength)
  }
  function leave() { x.set(0); y.set(0) }
  return (
    <motion.button
      ref={ref} type={type} onClick={onClick} onPointerMove={move} onPointerLeave={leave}
      aria-label={ariaLabel} whileTap={{ scale: 0.97 }}
      style={{ x: sx, y: sy, ...style }} className={className}>
      {children}
    </motion.button>
  )
}
