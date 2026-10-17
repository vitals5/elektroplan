import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { isBundledSupplierLogo, neutralSourceLabel, prepareProjectPresentation } from './PresentationNaming';
import { defaultCoverPageTemplate, coverPageLogo, coverPageSvg, createCoverPage } from './CoverPage';
import { PageImage, Project } from './types';

assert.equal(neutralSourceLabel('EPLAN P8 / EPLAN-Haus / P8'),'Projektarchiv / Projektarchiv-Haus / Projektarchiv');
assert.equal(neutralSourceLabel('Elektroplan Suite'),'Elektroplan Suite');
assert.equal(neutralSourceLabel('Replanning einer Anlage'),'Replanning einer Anlage');
const project={id:'p',name:'EPLAN-Haus',company:'Eigene Firma',description:'Haus',author:'Planer',created:'',modified:'',pages:[],activePageId:''} as unknown as Project;
const page=createCoverPage(project);project.pages.push(page);project.coverPageTemplate=defaultCoverPageTemplate();
project.coverPageTemplate.properties={'10000:0':'EPLAN-Haus'};
page.coverPage={values:{'10000:0':'EPLAN-Haus'}};
page.components=[{id:'eplan_1_17_1',symbolId:'eplan:IEC:1:0',bmk:'-P8',functionText:'Eigener Text',x:1,y:2,rotation:0,pins:{},source:{format:'EPLAN_P8',objectType:17,objectId:1}}];
const componentBefore=JSON.stringify(page.components);
prepareProjectPresentation(project);
assert.equal(project.name,'Haus');assert.equal(page.plotFrame.titleBlock.projectTitle,'Haus');
assert.equal(project.coverPageTemplate.properties['10000:0'],'Haus');assert.equal(page.coverPage.values!['10000:0'],'Haus');
assert.equal(JSON.stringify(page.components),componentBefore,'Electrical identities and user labels remain intact');
const custom:PageImage={id:'own-logo',caption:'EPLAN.jpg',x:64,y:24,width:29,height:40,dataUrl:'data:image/png;base64,custom'};
assert(!isBundledSupplierLogo(custom),'A custom replacement with an old filename is preserved');
if(fs.existsSync('Eplan Haus.zip.001')&&fs.existsSync('Eplan Haus.zip.002')){
  const zip=await JSZip.loadAsync(Buffer.concat(['Eplan Haus.zip.001','Eplan Haus.zip.002'].map(path=>fs.readFileSync(path))));
  const file=Object.values(zip.files).find(f=>/Images\/bc146770\/EPLAN\.jpg$/.test(f.name))!;
  const bundled={...custom,id:'source-logo',dataUrl:`data:image/jpeg;base64,${await file.async('base64')}`};
  assert(isBundledSupplierLogo(bundled));project.coverPageTemplate.images=[bundled];
  assert.equal(coverPageLogo(page,project),undefined,'Older resources cannot reintroduce the supplier logo');
  assert.doesNotMatch(coverPageSvg(page,project),/class="cover-logo"/);
  page.coverPage.logo=bundled;page.images=[bundled];prepareProjectPresentation(project);
  assert.equal(project.coverPageTemplate.images.length,0);assert.equal(page.coverPage.logo,null);assert.equal(page.images.length,0);
  page.coverPage.logo=custom;prepareProjectPresentation(project);assert.deepEqual(page.coverPage.logo,custom);
}
const before=JSON.stringify(project);prepareProjectPresentation(project);assert.equal(JSON.stringify(project),before,'Repeated loading does not change migrated data');
console.log('✓ Neutral application wording, legacy example migration, supplier-logo removal and preserved custom/electrical data');
