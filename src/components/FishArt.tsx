import { useId } from 'react'

/*
 * 어종 일러스트 (SVG로 그린 단순화 그림, 왼쪽을 보는 옆모습)
 * - species.code 기준. 등록 안 된 코드(사용자 추가 어종 u123 등)는 기본 물고기
 * - 나중에 실사풍 그림 파일이 생기면 public/fish/<code>.png 로 넣고 IMAGE_FILES에 코드를 추가하면 그걸 씀
 */
const IMAGE_FILES = new Set<string>([])

type Fish = {
  shape: 'fish'
  h: number                       // 몸 높이 (반높이, viewBox 120x72 기준)
  len?: number                    // 몸 길이 (기본 82)
  body: string; belly: string; fin?: string
  dorsal?: 'spiky' | 'smooth' | 'double' | 'triple' | 'none'
  tail?: 'fork' | 'deep' | 'round' | 'straight'
  bands?: { n: number; color: string; opacity?: number }         // 세로 줄무늬
  stripe?: { color: string; wavy?: boolean }                    // 가로 줄(배스) / 물결 무늬(고등어)
  spots?: { color: string; n: number; big?: boolean }
  beak?: boolean; barbel?: boolean; bigMouth?: boolean; bigEye?: boolean
}
type Other = { shape: 'flat' | 'squid' | 'bigfin' | 'cuttle' | 'octopus'; body: string; belly: string; mark?: string; small?: boolean }
type Spec = Fish | Other

const SPECS: Record<string, Spec> = {
  korean_rockfish:    { shape: 'fish', h: 19, body: '#5E625F', belly: '#C9C4B5', fin: '#4A4E4B', dorsal: 'spiky', tail: 'straight', spots: { color: '#3B3F3C', n: 7 }, bigMouth: true },
  darkbanded_rockfish:{ shape: 'fish', h: 17, body: '#7A5A43', belly: '#D9C4A8', fin: '#5F4533', dorsal: 'spiky', tail: 'straight', bands: { n: 4, color: '#4E3A2B', opacity: .45 }, bigEye: true },
  greenling:          { shape: 'fish', h: 14, len: 86, body: '#8A6A3E', belly: '#E3D3AE', fin: '#6F5530', dorsal: 'smooth', tail: 'round', spots: { color: '#5E4626', n: 9 } },
  fat_greenling:      { shape: 'fish', h: 13, len: 88, body: '#6E5A3A', belly: '#DCCCA6', fin: '#C9772F', dorsal: 'smooth', tail: 'straight', bands: { n: 6, color: '#4C3D27', opacity: .35 } },
  black_porgy:        { shape: 'fish', h: 23, body: '#56616A', belly: '#DCE1E5', fin: '#3E474E', dorsal: 'spiky', tail: 'fork', bands: { n: 6, color: '#3B444B', opacity: .25 } },
  red_seabream:       { shape: 'fish', h: 23, body: '#E07A7A', belly: '#F7D6D2', fin: '#CF6464', dorsal: 'spiky', tail: 'fork', spots: { color: '#5AA7E8', n: 10 } },
  striped_beakperch:  { shape: 'fish', h: 23, body: '#DCD6C4', belly: '#F0ECE0', fin: '#2B2D2A', dorsal: 'spiky', tail: 'straight', bands: { n: 7, color: '#2B2D2A', opacity: .85 } },
  opaleye:            { shape: 'fish', h: 21, body: '#2F3C3B', belly: '#5A6862', fin: '#232D2C', dorsal: 'smooth', tail: 'fork' },
  goby:               { shape: 'fish', h: 11, len: 86, body: '#8E8467', belly: '#DCD5BD', fin: '#766D53', dorsal: 'double', tail: 'round', spots: { color: '#5E5640', n: 8 }, bigMouth: true },
  chub_mackerel:      { shape: 'fish', h: 13, len: 86, body: '#2E6E8E', belly: '#E6ECEF', fin: '#285E79', dorsal: 'double', tail: 'deep', stripe: { color: '#16384A', wavy: true } },
  horse_mackerel:     { shape: 'fish', h: 14, body: '#6E8C97', belly: '#E3E9EB', fin: '#5C7882', dorsal: 'double', tail: 'deep', stripe: { color: '#B9C6CC' } },
  spanish_mackerel:   { shape: 'fish', h: 11, len: 90, body: '#4E6F86', belly: '#E8EDF0', fin: '#3F5C70', dorsal: 'double', tail: 'deep', spots: { color: '#2F4A5C', n: 12 } },
  halfbeak:           { shape: 'fish', h: 7, len: 90, body: '#6FA0B8', belly: '#EEF4F6', fin: '#5A8BA3', dorsal: 'none', tail: 'fork', stripe: { color: '#C9DDE6' }, beak: true },
  sea_bass:           { shape: 'fish', h: 15, len: 86, body: '#6F7F86', belly: '#E6EAEC', fin: '#5A6970', dorsal: 'double', tail: 'fork', spots: { color: '#3F4A50', n: 6 }, bigMouth: true },
  pacific_cod:        { shape: 'fish', h: 18, len: 84, body: '#8C7B5C', belly: '#E9E0CB', fin: '#73644A', dorsal: 'triple', tail: 'straight', spots: { color: '#6A5C43', n: 10 }, barbel: true, bigMouth: true },
  crucian_carp:       { shape: 'fish', h: 22, body: '#8E7A3E', belly: '#E6D7A5', fin: '#77662F', dorsal: 'smooth', tail: 'fork' },
  largemouth_bass:    { shape: 'fish', h: 19, body: '#5E7A3E', belly: '#E2E8CB', fin: '#4C6531', dorsal: 'double', tail: 'straight', stripe: { color: '#2F4220' }, bigMouth: true },
  mandarin_fish:      { shape: 'fish', h: 17, body: '#B59A54', belly: '#EBE0B9', fin: '#957D40', dorsal: 'spiky', tail: 'round', spots: { color: '#3E3220', n: 11, big: true }, bigMouth: true },
  olive_flounder:     { shape: 'flat', body: '#7B6A4F', belly: '#5F5139', mark: '#4A3F2C' },
  webfoot_octopus:    { shape: 'octopus', body: '#A86A5A', belly: '#C99484', mark: '#E3B34C', small: true },
  common_octopus:     { shape: 'octopus', body: '#B5634E', belly: '#D18E79', mark: '#8E4A39' },
  cuttlefish:         { shape: 'cuttle', body: '#8A7660', belly: '#B9A68E', mark: '#5B4C3B' },
  bigfin_reef_squid:  { shape: 'bigfin', body: '#C8A9A0', belly: '#E7D6D0', mark: '#9B7468' },
  common_squid:       { shape: 'squid', body: '#C77D5E', belly: '#E3B49E', mark: '#9E583D' },
}
const DEFAULT: Fish = { shape: 'fish', h: 17, body: '#8A939B', belly: '#DCE1E5', fin: '#737C84', dorsal: 'smooth', tail: 'fork' }

export default function FishArt({ code, name, size = 48 }: { code?: string | null; name?: string; size?: number }) {
  const uid = useId().replace(/:/g, '')
  const label = name ? `${name} 그림` : '물고기 그림'
  if (code && IMAGE_FILES.has(code)) return <img src={`/fish/${code}.png`} alt={label} width={size} height={size * 0.6} style={{ objectFit: 'contain' }} />
  const s = (code && SPECS[code]) || DEFAULT
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 120 72" role="img" aria-label={label}>
      {s.shape === 'fish' ? <FishBody s={s} id={uid} />
        : s.shape === 'flat' ? <Flat s={s} />
        : s.shape === 'octopus' ? <Octopus s={s} />
        : s.shape === 'cuttle' ? <Cuttle s={s} />
        : <Squid s={s} big={s.shape === 'bigfin'} />}
    </svg>
  )
}

/* 일반 물고기: 코(왼쪽) → 꼬리(오른쪽) */
function FishBody({ s, id }: { s: Fish; id: string }) {
  const cy = 36, x0 = 10, len = s.len ?? 82, x1 = x0 + len, h = s.h
  const body = `M${x0},${cy} C${x0 + len * 0.18},${cy - h * 1.05} ${x0 + len * 0.62},${cy - h * 1.08} ${x1},${cy - 2} L${x1},${cy + 2} C${x0 + len * 0.62},${cy + h * 1.0} ${x0 + len * 0.18},${cy + h * 0.95} ${x0},${cy} Z`
  const fin = s.fin ?? s.body
  const tw = Math.min(20, 118 - x1), th = Math.max(9, h * 0.75)
  const tail =
    s.tail === 'deep' ? `M${x1 - 2},${cy} L${x1 + tw},${cy - th - 3} L${x1 + tw * 0.45},${cy} L${x1 + tw},${cy + th + 3} Z`
    : s.tail === 'round' ? `M${x1 - 2},${cy} C${x1 + tw * 1.2},${cy - th - 2} ${x1 + tw * 1.2},${cy + th + 2} ${x1 - 2},${cy} Z`
    : s.tail === 'straight' ? `M${x1 - 2},${cy - 2} L${x1 + tw},${cy - th} L${x1 + tw - 1},${cy + th} L${x1 - 2},${cy + 2} Z`
    : `M${x1 - 2},${cy} L${x1 + tw},${cy - th} L${x1 + tw * 0.6},${cy} L${x1 + tw},${cy + th} Z`
  const top = (t: number) => cy - h * 1.0 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)) * 0.95) - 0.5
  const dx = (t: number) => x0 + len * t
  const dorsal = (() => {
    switch (s.dorsal) {
      case 'spiky': {
        let p = `M${dx(0.28)},${top(0.28)}`
        for (let i = 0; i < 7; i++) { const a = 0.28 + i * 0.05; p += ` L${dx(a + 0.025)},${top(a + 0.025) - 7} L${dx(a + 0.05)},${top(a + 0.05)}` }
        return p + ` L${dx(0.72)},${top(0.72) - 4} L${dx(0.78)},${top(0.78)} Z`
      }
      case 'double': return `M${dx(0.3)},${top(0.3)} Q${dx(0.38)},${top(0.38) - 9} ${dx(0.46)},${top(0.46)} Z M${dx(0.55)},${top(0.55)} Q${dx(0.63)},${top(0.63) - 6} ${dx(0.72)},${top(0.72)} Z`
      case 'triple': return [0.28, 0.46, 0.64].map(a => `M${dx(a)},${top(a)} Q${dx(a + 0.07)},${top(a + 0.07) - 7} ${dx(a + 0.14)},${top(a + 0.14)} Z`).join(' ')
      case 'none': return ''
      default: return `M${dx(0.3)},${top(0.3)} C${dx(0.4)},${top(0.4) - 8} ${dx(0.65)},${top(0.65) - 7} ${dx(0.76)},${top(0.76)} Z`
    }
  })()
  const eyeX = x0 + len * 0.12, eyeY = cy - h * 0.32, eyeR = s.bigEye ? 3.6 : 2.8
  return (
    <g>
      <defs><clipPath id={`b${id}`}><path d={body} /></clipPath></defs>
      <path d={tail} fill={fin} />
      {dorsal && <path d={dorsal} fill={fin} />}
      {/* 배지느러미 */}
      <path d={`M${dx(0.34)},${cy + h * 0.85} q4,8 10,6 q-2,-5 -4,-8 Z`} fill={fin} opacity={.9} />
      <path d={body} fill={s.body} />
      <g clipPath={`url(#b${id})`}>
        <rect x={0} y={cy + h * 0.15} width={120} height={40} fill={s.belly} />
        {s.bands && Array.from({ length: s.bands.n }, (_, i) => (
          <rect key={i} x={x0 + len * (0.2 + (i * 0.7) / s.bands!.n)} y={0} width={len * 0.045} height={72} fill={s.bands!.color} opacity={s.bands!.opacity ?? .5} />
        ))}
        {s.stripe && (s.stripe.wavy
          ? Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${dx(0.2 + i * 0.12)},${cy - h} q3,${h * 0.35} 0,${h * 0.7}`} stroke={s.stripe!.color} strokeWidth={2} fill="none" />)
          : <rect x={x0} y={cy - 2.5} width={len} height={4} fill={s.stripe.color} opacity={.8} />)}
        {s.spots && Array.from({ length: s.spots.n }, (_, i) => {
          const t = 0.22 + ((i * 0.618) % 1) * 0.66, v = ((i * 0.381) % 1) * 1.4 - 0.8
          return <circle key={i} cx={dx(t)} cy={cy + v * h * 0.7} r={s.spots!.big ? 2.6 : 1.5} fill={s.spots!.color} opacity={.8} />
        })}
      </g>
      {/* 아가미 선 */}
      <path d={`M${dx(0.24)},${cy - h * 0.6} q-4,${h * 0.6} 0,${h * 1.1}`} stroke="rgba(0,0,0,.22)" strokeWidth={1.4} fill="none" />
      <circle cx={eyeX} cy={eyeY} r={eyeR} fill="#fff" />
      <circle cx={eyeX - 0.6} cy={eyeY} r={eyeR * 0.55} fill="#1B1D1F" />
      {s.bigMouth ? <path d={`M${x0 + 1},${cy + 1} l7,2`} stroke="rgba(0,0,0,.45)" strokeWidth={1.4} strokeLinecap="round" />
        : <path d={`M${x0 + 1},${cy + 1} l4,1`} stroke="rgba(0,0,0,.4)" strokeWidth={1.2} strokeLinecap="round" />}
      {s.beak && <path d={`M${x0 + 2},${cy + 1} L${x0 - 8},${cy + 3} L${x0 + 2},${cy + 3} Z`} fill="#E36B2C" />}
      {s.barbel && <path d={`M${x0 + 4},${cy + 4} q-1,5 -3,7`} stroke={s.fin ?? s.body} strokeWidth={1.4} fill="none" />}
    </g>
  )
}

/* 광어: 납작한 몸, 눈 둘이 위쪽, 지느러미 테두리 */
function Flat({ s }: { s: Other }) {
  const body = 'M8,38 C14,18 60,10 88,24 C96,28 98,34 98,38 C98,44 94,50 86,54 C58,66 14,58 8,38 Z'
  return (
    <g>
      <path d="M100,38 L116,26 L114,50 Z" fill={s.belly} />
      <path d={body} fill={s.belly} transform="translate(0,0) scale(1.0)" stroke={s.belly} strokeWidth={6} strokeLinejoin="round" />
      <path d={body} fill={s.body} />
      {[[30, 32], [46, 28], [62, 34], [48, 46], [70, 44], [36, 48], [80, 34]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.4} fill={s.mark} opacity={.7} />)}
      <circle cx={20} cy={30} r={2.8} fill="#fff" /><circle cx={19.6} cy={30} r={1.6} fill="#1B1D1F" />
      <circle cx={26} cy={26} r={2.8} fill="#fff" /><circle cx={25.6} cy={26} r={1.6} fill="#1B1D1F" />
      <path d="M10,39 l6,1" stroke="rgba(0,0,0,.45)" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

/* 문어·주꾸미: 둥근 머리 + 말린 다리 */
function Octopus({ s }: { s: Other }) {
  const k = s.small ? 0.85 : 1
  return (
    <g transform={`translate(${60 - 60 * k},${(1 - k) * 30}) scale(${k})`}>
      {[[-1, 22], [-0.5, 30], [0, 34], [0.5, 30], [1, 22]].map(([d, l], i) => (
        <path key={i} d={`M${60 + d * 14},40 q${d * 14},${l * 0.5} ${d * 22 + 6},${l * 0.6} q4,2 2,-4`} stroke={s.body} strokeWidth={7 - Math.abs(d) * 2} strokeLinecap="round" fill="none" />
      ))}
      <ellipse cx={60} cy={26} rx={22} ry={20} fill={s.body} />
      <ellipse cx={54} cy={20} rx={8} ry={6} fill={s.belly} opacity={.6} />
      {s.small && <circle cx={50} cy={36} r={4} fill="none" stroke={s.mark} strokeWidth={2} />}
      {!s.small && [[66, 16], [72, 26], [58, 32]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2} fill={s.mark} opacity={.6} />)}
      <circle cx={52} cy={38} r={2.6} fill="#fff" /><circle cx={52} cy={38} r={1.4} fill="#1B1D1F" />
      <circle cx={68} cy={38} r={2.6} fill="#fff" /><circle cx={68} cy={38} r={1.4} fill="#1B1D1F" />
    </g>
  )
}

/* 갑오징어: 넓은 타원 몸 + 테두리 지느러미 + 얼룩무늬, 짧은 다리 */
function Cuttle({ s }: { s: Other }) {
  return (
    <g>
      {[0, 1, 2, 3].map(i => <path key={i} d={`M30,${30 + i * 4} q-12,${-4 + i * 3} -22,${-6 + i * 5}`} stroke={s.body} strokeWidth={3.5} strokeLinecap="round" fill="none" />)}
      <ellipse cx={70} cy={36} rx={44} ry={20} fill={s.belly} />
      <ellipse cx={70} cy={36} rx={40} ry={16} fill={s.body} />
      {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${42 + i * 9},22 q4,14 0,28`} stroke={s.mark} strokeWidth={2.2} fill="none" opacity={.7} />)}
      <circle cx={34} cy={30} r={3.4} fill="#fff" /><path d="M31.5,30 q2.5,-2 5,0 q-2.5,2 -5,0 Z" fill="#1B1D1F" />
    </g>
  )
}

/* 오징어: 길쭉한 몸통 + 꼬리 쪽 지느러미(살오징어) / 몸통 전체 지느러미(무늬오징어) */
function Squid({ s, big }: { s: Other; big: boolean }) {
  const mantle = 'M34,28 C56,22 92,26 104,36 C92,46 56,50 34,44 Z'
  return (
    <g>
      {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M34,${30 + i * 3} q-12,${-3 + i * 2} -26,${-4 + i * 4}`} stroke={s.body} strokeWidth={2.6} strokeLinecap="round" fill="none" />)}
      <path d="M34,34 q-16,0 -28,-8" stroke={s.body} strokeWidth={2} fill="none" />
      {big
        ? <path d="M40,26 C64,8 96,14 110,36 C96,58 64,64 40,46 Z" fill={s.belly} opacity={.9} />
        : <path d="M84,30 L114,22 L106,36 L114,50 L84,42 Z" fill={s.belly} />}
      <path d={mantle} fill={s.body} />
      {Array.from({ length: big ? 9 : 5 }, (_, i) => <circle key={i} cx={46 + i * (big ? 6 : 10)} cy={34 + ((i % 3) - 1) * 4} r={1.6} fill={s.mark} opacity={.7} />)}
      <circle cx={34} cy={32} r={3.2} fill="#fff" /><circle cx={33.4} cy={32} r={1.8} fill="#1B1D1F" />
    </g>
  )
}
