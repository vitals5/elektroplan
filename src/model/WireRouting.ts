import { Page, PinDefinition, Project, Wire } from './types';
import { getSymbolForComponent } from './symbols';

type Point = { x: number; y: number };
type Direction = PinDefinition['direction'];

export function wirePinDirection(page: Page, project: Project, endpoint: Wire['from']): Direction | undefined {
  const component = page.components.find(c => c.id === endpoint.componentId);
  if (!component) return;
  const symbol = getSymbolForComponent(component, project);
  const pin = symbol?.pins.find(p => p.id === endpoint.pinId);
  if (!pin) return;
  const directions: Direction[] = ['top', 'right', 'bottom', 'left'];
  return directions[(directions.indexOf(pin.direction) + Math.round((component.rotation || 0) / 90)) % 4];
}

/** Preserve explicit routing anchors while reconnecting moved pins orthogonally.
 * The result is transient; moving a component never rewrites its imported route.
 */
export function orthogonalWirePoints(from: Point, to: Point, waypoints: readonly Point[], fromDirection?: Direction, toDirection?: Direction): Point[] {
  const aligned = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-8 || Math.abs(a.y - b.y) < 1e-8;
  const connector = (a: Point, b: Point, direction?: Direction): Point[] => {
    if (aligned(a, b)) return [a, b];
    const vertical = direction !== 'left' && direction !== 'right';
    // Use the rotated pin axis. If the nearest anchor is behind the pin, first
    // leave the pin on its outward side before turning back towards the anchor.
    const forward = direction === 'top' ? b.y < a.y : direction === 'bottom' ? b.y > a.y
      : direction === 'left' ? b.x < a.x : direction === 'right' ? b.x > a.x : true;
    if (forward) return [a, vertical ? { x: a.x, y: b.y } : { x: b.x, y: a.y }, b];
    const stub = { x: a.x + (direction === 'left' ? -8 : direction === 'right' ? 8 : 0),
      y: a.y + (direction === 'top' ? -8 : direction === 'bottom' ? 8 : 0) };
    return [a, stub, vertical ? { x: b.x, y: stub.y } : { x: stub.x, y: b.y }, b];
  };
  if (!waypoints.length) return connector(from, to, fromDirection).map(p => ({ ...p }));
  const points: Point[] = [from];
  for (let i = 0; i < waypoints.length; i++) {
    points.push(...connector(points.at(-1)!, waypoints[i], i === 0 ? fromDirection : undefined).slice(1));
  }
  points.push(...connector(to, points.at(-1)!, toDirection).reverse().slice(1));
  return points.map(p => ({ ...p }));
}
