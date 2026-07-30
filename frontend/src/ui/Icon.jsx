import {
  Compass, ShieldCheck, ChatCircle, Lightning, Sparkle, ChatCircleDots, Paperclip,
  WarningCircle, X, Terminal, PaperPlaneRight, ArrowsClockwise, ArrowRight, ArrowUpRight,
  MagnifyingGlass, BookOpen, PencilSimple, PlusCircle, House, ArrowDown, Stop, FilePdf,
  FileText, Article, File as FileIcon, Globe, GlobeHemisphereWest, BookOpenText, ChartLineUp,
  Brain, ChartBar, GearSix, Hourglass, Check, Copy, Warning, Trash, ChatsCircle, Plus,
  Microphone, Quotes, Stamp, Receipt, Scissors, PushPin, Tray, Timer,
} from '@phosphor-icons/react'

// Legacy name map: keeps <Icon name="..." style={{ fontSize, color, fontVariationSettings }} />
// call sites working (size from fontSize, fill weight from a Material FILL flag).
const ICONS = {
  travel_explore: Compass, verified_user: ShieldCheck, chat: ChatCircle, bolt: Lightning,
  auto_awesome: Sparkle, chat_bubble: ChatCircleDots, attach_file: Paperclip,
  error_outline: WarningCircle, close: X, terminal: Terminal, send: PaperPlaneRight,
  refresh: ArrowsClockwise, arrow_forward: ArrowRight, arrow_outward: ArrowUpRight,
  search: MagnifyingGlass, auto_stories: BookOpen, edit: PencilSimple, add_circle: PlusCircle,
  home: House, arrow_downward: ArrowDown, stop: Stop, picture_as_pdf: FilePdf,
  description: FileText, article: Article, draft: FileIcon, public: Globe,
  language: GlobeHemisphereWest, menu_book: BookOpenText, analytics: ChartLineUp,
  psychology: Brain, monitoring: ChartBar, settings: GearSix, hourglass_empty: Hourglass,
  check: Check, content_copy: Copy, warning: Warning, delete: Trash, forum: ChatsCircle,
  add: Plus, mic: Microphone, quote: Quotes, stamp: Stamp, receipt: Receipt,
  scissors: Scissors, pin: PushPin, tray: Tray, timer: Timer,
}

export function Icon({ name, className = '', style = {}, size, weight }) {
  const Cmp = ICONS[name] || Sparkle
  const { fontSize, fontVariationSettings, color, ...rest } = style || {}
  const px = size ?? (fontSize ? parseInt(fontSize, 10) : 20)
  const fill = typeof fontVariationSettings === 'string' && fontVariationSettings.includes("'FILL' 1")
  return <Cmp size={px} weight={weight ?? (fill ? 'fill' : 'regular')} color={color || 'currentColor'} className={className} style={rest} />
}

export default Icon
