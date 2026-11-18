import { useEffect, useRef, useState, type ReactNode } from 'react'

type Pt = [number, number]

interface AnimationDef {
  viewBox: string
  thumbViewBox: string
  /** Pose parameter 0..1 to a drawing. */
  figure: (p: number) => ReactNode
  /** Tempo for one rep, in milliseconds, and the caption for each part of it. */
  tempo: { up: number; top: number; down: number; bottom: number }
  captions: { up: string; top: string; down: string; bottom: string }
}

function Seg({ a, b, w, cls }: { a: Pt; b: Pt; w: number; cls: string }) {
  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={w} strokeLinecap="round" className={cls} />
}

// ---- Overhead cable tricep extension with a straight bar (side view, facing right, cable stack behind) ----
const SH: Pt = [176, 142]
const EL: Pt = [186, 76]
const L2 = 58
const PULLEY: Pt = [66, 352]
const A0 = 114.8 // forearm angle (degrees) at the stretch
const A1 = 278.6 // forearm angle at lockout

function hand(p: number): Pt {
  const a = ((A0 + (A1 - A0) * p) * Math.PI) / 180
  return [EL[0] + L2 * Math.cos(a), EL[1] + L2 * Math.sin(a)]
}
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])
const L0 = dist(hand(0), PULLEY)

function overheadCableTricep(p: number): ReactNode {
  const h = hand(p)
  const plateY = 292 - (dist(h, PULLEY) - L0) // the selected plate rises as the cable is pulled out
  const farElbow: Pt = [EL[0] + 6, EL[1] + 4]
  const farHand: Pt = [h[0] + 6, h[1] + 4]
  return (
    <g>
      <line x1="4" y1="370" x2="246" y2="370" stroke="var(--border)" strokeWidth="3" strokeLinecap="round" />
      {Array.from({ length: 22 }, (_, i) => (
        <rect key={i} x="14" y={92 + i * 12.5} width="38" height="10" rx="2" fill="var(--border)" />
      ))}
      <rect x="12" y={plateY} width="42" height="11" rx="2" fill="var(--accent)" />
      <line x1="54" y1={plateY + 5.5} x2="66" y2={plateY + 5.5} stroke="var(--muted)" strokeWidth="2" />
      <line x1="66" y1={plateY + 5.5} x2="66" y2="345" stroke="var(--muted)" strokeWidth="2" />
      <circle cx="66" cy="352" r="9" fill="var(--surface)" stroke="var(--muted)" strokeWidth="2.5" />
      <circle cx="66" cy="352" r="2.5" fill="var(--muted)" />
      <line x1="66" y1="352" x2={h[0]} y2={h[1]} stroke="var(--muted)" strokeWidth="2" />

      <Seg a={[168, 232]} b={[182, 298]} w={13} cls="fig far" />
      <Seg a={[182, 298]} b={[186, 358]} w={10} cls="fig far" />
      <Seg a={[186, 358]} b={[206, 362]} w={8} cls="fig far" />
      <Seg a={[SH[0] + 4, SH[1] + 2]} b={farElbow} w={9} cls="fig far" />
      <Seg a={farElbow} b={farHand} w={8} cls="fig far" />

      <Seg a={[168, 232]} b={[170, 300]} w={14} cls="fig" />
      <Seg a={[170, 300]} b={[168, 358]} w={11} cls="fig" />
      <Seg a={[168, 358]} b={[190, 362]} w={8} cls="fig" />
      <Seg a={[168, 232]} b={SH} w={17} cls="fig" />
      <Seg a={SH} b={[178, 124]} w={10} cls="fig" />
      <circle cx="183" cy="102" r="17" className="fig-fill" />

      <Seg a={SH} b={EL} w={15} cls="halo" />
      <Seg a={EL} b={h} w={14} cls="halo" />
      <Seg a={SH} b={EL} w={10} cls="fig" />
      <Seg a={EL} b={h} w={9} cls="fig" />
      <line
        x1={SH[0] - 5} y1={SH[1] - 14} x2={EL[0] - 5} y2={EL[1] + 8}
        stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" opacity={0.35 + 0.65 * p}
      />
      <circle cx={h[0]} cy={h[1]} r="7" fill="var(--surface)" stroke="var(--text)" strokeWidth="3" />
      <circle cx={EL[0]} cy={EL[1]} r="4.5" fill="var(--surface)" stroke="var(--text)" strokeWidth="2" />
    </g>
  )
}

export const ANIMATIONS: Record<string, AnimationDef> = {
  'cable-overhead-tricep-bar': {
    viewBox: '0 10 250 380',
    thumbViewBox: '40 0 200 400',
    figure: overheadCableTricep,
    tempo: { up: 1400, top: 500, down: 2400, bottom: 500 },
    captions: { up: 'Press up and squeeze', top: 'Squeeze at the top', down: 'Lower slowly', bottom: 'Feel the stretch' },
  },
}

const FRAMES = [0, 0.2, 0.4, 0.6, 0.8, 1]
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)

function poseAt(def: AnimationDef, ms: number): { p: number; caption: string } {
  const { up, top, down, bottom } = def.tempo
  let t = ms % (up + top + down + bottom)
  if (t < up) return { p: ease(t / up), caption: def.captions.up }
  t -= up
  if (t < top) return { p: 1, caption: def.captions.top }
  t -= top
  if (t < down) return { p: 1 - ease(t / down), caption: def.captions.down }
  return { p: 0, caption: def.captions.bottom }
}

/** Looping drawn animation with six tappable key frames. */
export default function ExerciseAnimation({ kind, label }: { kind: string; label: string }) {
  const def = ANIMATIONS[kind]
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [playing, setPlaying] = useState(!reduce)
  const [pose, setPose] = useState<{ p: number; caption: string }>({ p: 0, caption: def?.captions.bottom ?? '' })
  const [frame, setFrame] = useState<number | null>(reduce ? 0 : null)
  const startRef = useRef(0)

  useEffect(() => {
    if (!def || !playing) return
    let raf = 0
    startRef.current = performance.now()
    const tick = (now: number) => {
      setPose(poseAt(def, now - startRef.current))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [def, playing])

  if (!def) return null

  const shownP = frame !== null ? FRAMES[frame] : pose.p
  const caption = frame !== null ? `Frame ${frame + 1} of 6` : playing ? pose.caption : 'Paused'

  return (
    <div className="anim">
      <svg viewBox={def.viewBox} className="anim-main" role="img" aria-label={`Side-view drawing: ${label}`}>
        {def.figure(shownP)}
      </svg>
      <div className="anim-bar">
        <span className="anim-caption">{caption}</span>
        <button
          type="button"
          className="small"
          onClick={() => {
            setFrame(null)
            setPlaying((v) => (frame !== null ? true : !v))
          }}
        >
          {playing && frame === null ? 'Pause' : 'Play'}
        </button>
      </div>
      <div className="anim-strip">
        {FRAMES.map((p, i) => (
          <button
            key={i}
            type="button"
            className={frame === i ? 'on' : ''}
            aria-label={`Frame ${i + 1}`}
            aria-pressed={frame === i}
            onClick={() => {
              setPlaying(false)
              setFrame(i)
            }}
          >
            <svg viewBox={def.thumbViewBox} aria-hidden="true">{def.figure(p)}</svg>
            <span>{i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
