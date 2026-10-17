import assert from 'node:assert/strict';
import { Page, Project, SymbolDefinition } from './types';
import { elementsInWindow, componentBounds, captureSelectionMove, translateSelection } from './ElementSelection';
import { sharedPropertyValue, applySelectionProperties } from './SelectionProperties';
import { ProjectHistory } from './ProjectHistory';
const symbol:SymbolDefinition={id:'s',name:'s',category:'controls',standard:'DIN EN 60617',defaultBmkPrefix:'',defaultFunctionText:'',width:20,height:40,svgContent:'',pins:[],description:''};
const page={id:'p',components:[
  {id:'a',symbolId:'s',x:.75,y:.5,rotation:0,bmk:'-A',functionText:'Alpha',pins:{},bmkPosition:{fontSize:6,offsetX:7,rotation:180,visible:false}},
  {id:'b',symbolId:'s',x:100.75,y:.5,rotation:90,bmk:'-B',functionText:'Beta',pins:{},bmkPosition:{fontSize:8}},
  {id:'c',symbolId:'s',x:500,y:300,rotation:0,bmk:'-C',functionText:'Fixed',pins:{}},
  {id:'hidden',symbolId:'s',x:30,y:0,rotation:0,bmk:'',functionText:'',pins:{},source:{format:'EPLAN_P8',objectType:42,objectId:1,routingUsed:false}},
],wires:[{id:'inner',from:{componentId:'a',pinId:'1'},to:{componentId:'b',pinId:'1'},waypoints:[{x:50.75,y:60.5}],potential:'Signal'},
  {id:'external',from:{componentId:'b',pinId:'1'},to:{componentId:'c',pinId:'1'},waypoints:[{x:200,y:160}],potential:'Signal'}],
  cables:[{id:'cable',start:{x:0,y:60},end:{x:120,y:60},bmk:'-W1',cableType:'NYM-J',coreCount:2,crossSection:'1,5',cores:[],labelOffset:{x:-3,y:-4}}]
} as unknown as Page;
const project={id:'p',name:'Test',activePageId:'p',pages:[page],symbolLibrary:[symbol],drawingUnitsPerMm:2,modified:''} as unknown as Project;
const original=JSON.stringify(page);
assert.deepEqual(componentBounds(page,project,'b'),{left:90.75,top:10.5,right:130.75,bottom:30.5});
const selection=elementsInWindow(page,project,{x:-5,y:-5},{x:140,y:70});
assert.deepEqual(selection,{componentIds:['a','b'],cableIds:['cable']});
assert.equal(JSON.stringify(page),original,'Marquee selection is view state only');
assert.equal(sharedPropertyValue(page,project,selection,'bmkFontSize'),undefined,'Mixed sizes are not silently replaced');
assert.equal(sharedPropertyValue(page,project,selection,'crossRefFontSize'),4);
const history=new ProjectHistory();history.reset(project);
const snapshot=captureSelectionMove(page,selection);
translateSelection(page,snapshot,20,40);translateSelection(page,snapshot,40,60);
assert.deepEqual([page.components[0].x,page.components[0].y],[40.75,60.5]);
assert.deepEqual([page.components[1].x,page.components[1].y],[140.75,60.5]);
assert.deepEqual(page.wires[0].waypoints,[{x:90.75,y:120.5}]);
assert.deepEqual(page.wires[1].waypoints,[{x:200,y:160}]);
assert.deepEqual(page.cables![0].start,{x:40,y:120});
assert.deepEqual(page.cables![0].labelOffset,{x:-3,y:-4});assert.equal(page.components[2].x,500);
history.record(project);const restored=history.undo()!;assert.deepEqual(restored.pages[0],JSON.parse(original),'One move restores the whole group and its bends');
assert(applySelectionProperties(page,project,selection,{bmkFontSize:1.8,crossRefFontSize:1.2}));
assert.deepEqual(page.components[0].bmkPosition,{fontSize:3.6,offsetX:7,rotation:180,visible:false});
assert.equal(page.components[1].bmkPosition!.fontSize,3.6);assert.equal(page.components[0].crossRefFontSize,2.4);
assert.equal(page.components[2].crossRefFontSize,undefined);assert.equal(page.components[1].functionText,'Beta');
assert.equal(page.cables![0].bmkFontSize,3.6);assert.equal(page.cables![0].cableType,'NYM-J');
const beforeInvalid=JSON.stringify(page);
assert.throws(()=>applySelectionProperties(page,project,selection,{functionText:'Bad partial write',bmkFontSize:NaN}));
assert.equal(JSON.stringify(page),beforeInvalid,'Invalid shared changes are rejected atomically');
assert.equal(applySelectionProperties(page,project,selection,{}),false);
console.log('✓ Window selection, rotated bounds, relative group movement, internal routes and atomic shared font properties');
