import assert from 'node:assert/strict';
import { getSymbolById, setProjectSymbolLibrary } from './symbols';
import { isConnectionSymbol, interruptionLabelPosition } from './ConnectionSymbols';
import { AutoconnectEngine } from './AutoconnectEngine';
import { rotatedLocalPoint } from './SymbolGeometry';
import { PlacedComponent, Project, SymbolDefinition } from './types';

for (const symbolId of ['potential_arrow','potential_arrow_right','potential_arrow_left','potential_arrow_up','potential_arrow_down']) {
  const sym = getSymbolById(symbolId)!;
  assert(isConnectionSymbol(sym));
  assert.equal(sym.pins.length, 2);
  for (const rotation of [0,90,180,270] as const) {
    const arrow: PlacedComponent = {id:'arrow',symbolId,bmk:'L',functionText:'L',x:200,y:200,rotation,pins:{}};
    const targets = sym.pins.map((p,i) => {
      const pin = AutoconnectEngine.getRotatedPinInfo(arrow,p,sym);
      const delta = {top:[0,-100],right:[100,0],bottom:[0,100],left:[-100,0]}[pin.direction];
      const opposite = {top:'bottom',right:'left',bottom:'top',left:'right'}[pin.direction] as 'top'|'right'|'bottom'|'left';
      const target: SymbolDefinition = {...sym,id:'target-'+i,width:0,height:0,pins:[{id:'0',name:'',x:0,y:0,direction:opposite}]};
      return {target, component:{...arrow,id:target.id,symbolId:target.id,rotation:0 as const,x:pin.worldX+delta[0],y:pin.worldY+delta[1]}};
    });
    setProjectSymbolLibrary({pages:[],symbolLibrary:targets.map(t=>t.target)} as unknown as Project);
    const pairs = AutoconnectEngine.findAutoconnectPairs([arrow,...targets.map(t=>t.component)]);
    assert.equal(pairs.filter(p=>p.pin1.componentId==='arrow'||p.pin2.componentId==='arrow').length,2,`${symbolId} ${rotation}° connects on both sides`);
    const before = interruptionLabelPosition({settings:{interruptionLabelSide:'before'}} as Project,arrow,sym)!;
    const after = interruptionLabelPosition({settings:{interruptionLabelSide:'after'}} as Project,arrow,sym)!;
    const a=rotatedLocalPoint(before,sym,rotation),b=rotatedLocalPoint(after,sym,rotation);
    assert(Math.hypot(a.x-b.x,a.y-b.y)>sym.width);
    if(a.x<b.x-1e-6) assert.equal(before.anchor,'end');
    if(a.x>b.x+1e-6) assert.equal(before.anchor,'start');
  }
}
// Native interruption points have coincident opposite ports; input order must
// never hide one of them during the adjacent-position search.
const native = {...getSymbolById('potential_arrow_right')!,id:'native',pins:[
  {id:'0',name:'',x:10,y:10,direction:'left' as const},
  {id:'1',name:'',x:10,y:10,direction:'right' as const}]};
setProjectSymbolLibrary({pages:[],symbolLibrary:[native]} as unknown as Project);
const components = [0,100,200].map((x,i)=>({id:String(i),symbolId:'native',bmk:'',functionText:'',x,y:0,rotation:0 as const,pins:{}}));
assert.equal(AutoconnectEngine.findAutoconnectPairs(components).length,2);
assert.equal(AutoconnectEngine.findAutoconnectPairs(components.reverse()).length,2);
setProjectSymbolLibrary({pages:[],symbolLibrary:[]} as unknown as Project);
console.log('✓ Bidirectional interruption autoconnect and label side for every rotation, including coincident native ports');
