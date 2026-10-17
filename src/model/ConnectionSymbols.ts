import { SymbolDefinition, Project, PlacedComponent } from './types';

export function isInterruptionSymbol(s: SymbolDefinition): boolean {
  return s.id === 'potential_arrow' || s.id.startsWith('potential_arrow_')
    || s.source?.library === 'SPECIAL' && s.source.number === 8;
}
export function isConnectionSymbol(s: SymbolDefinition): boolean {
  return s.category === 'connections' || !!s.connectionGraphic || isInterruptionSymbol(s);
}
export function connectionFamily(s: SymbolDefinition): string {
  if (isInterruptionSymbol(s)) return 'interruptions';
  const n = s.source?.library === 'SPECIAL' ? s.source.number : -1;
  return s.id.startsWith('t_piece') || [64, 66, 67, 72, 78].includes(n) ? 'tees'
    : s.id.startsWith('corner') || [70, 75].includes(n) ? 'corners'
    : s.id.startsWith('cross') || [69, 77].includes(n) ? 'crossings' : 'other';
}
export function arrowDirection(s: SymbolDefinition): 'top' | 'right' | 'bottom' | 'left' {
  if (s.source?.library === 'SPECIAL' && s.source.number === 8)
    return (['right', 'top', 'left', 'bottom'] as const)[s.source.variant % 4];
  return s.id.endsWith('_up') ? 'top' : s.id.endsWith('_left') ? 'left' : s.id.endsWith('_right') ? 'right' : 'bottom';
}
/** Source layouts remain unchanged until selected; new arrows default to the tip side. */
export function interruptionLabelPosition(project: Project, comp: PlacedComponent, s: SymbolDefinition) {
  if (!isInterruptionSymbol(s)) return;
  let side = project.settings?.interruptionLabelSide;
  if (!side || side === 'source') {
    if (s.source) return;
    side = 'after';
  }
  let direction = arrowDirection(s);
  if (side === 'before') direction = ({ top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const)[direction];
  const gap = 3 * (s.unitsPerMm ?? 2);
  const turn = ((Math.round((comp.rotation || 0) / 90) % 4) + 4) % 4;
  const worldDirection = (['top','right','bottom','left'] as const)[(['top','right','bottom','left'].indexOf(direction) + turn) % 4];
  const anchor = worldDirection === 'left' ? 'end' as const : worldDirection === 'right' ? 'start' as const : 'middle' as const;
  const position = direction === 'left' ? { x: -gap, y: s.height / 2 }
    : direction === 'right' ? { x: s.width + gap, y: s.height / 2 }
    : direction === 'top' ? { x: s.width / 2, y: -gap }
    : { x: s.width / 2, y: s.height + gap };
  // The two lines stay horizontal in world space, also after a quarter turn.
  const lineStep = 10;
  const down = [{x:0,y:lineStep},{x:lineStep,y:0},{x:0,y:-lineStep},{x:-lineStep,y:0}][turn];
  if (comp.crossRef && worldDirection === 'top') { position.x -= down.x; position.y -= down.y; }
  return { ...position, anchor, referenceX: position.x + down.x, referenceY: position.y + down.y };
}
