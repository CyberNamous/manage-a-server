import { GAME_TITLE, AUTOSAVE_MS, SPEEDS, THEME_KEY } from './config.js';
import { BALANCE } from './data/tiers.js';
import { state, initialState, replaceState, addFeed } from './state.js';
import { loadGame, saveGame, exportCode, importCode } from './save.js';
import { startLoop, catchUp } from './loop.js';
import { purchaseServer, purchaseProtection } from './systems/capacity.js';
import { signCustomer, setPrice, chooseInfrastructure } from './systems/economy.js';
import { takeLoan, repayLoan } from './systems/loanSystem.js';
import { resolveEvent } from './systems/eventSystem.js';
import { createRenderer } from './ui/render.js';
import { setupLayout, selectTab } from './ui/layout.js';
import { setupTooltips } from './ui/tooltips.js';
import { setupModalKeyboard, showModal, closeModal, modalMode, eventModal, menuModal, goalsModal, helpModal, infrastructureModal, loanModal, toast } from './ui/modals.js';
import { escapeHTML } from './ui/format.js';
let theme='system', warnedStorage=false, tutorialIndex=-1;
const loaded=loadGame();
if(loaded.state){replaceState(loaded.state);catchUp(state,(Date.now()-state.savedAt)/1000);}
try{theme=localStorage.getItem(THEME_KEY)||'system';}catch{warnedStorage=true;}
if(!['system','light','dark'].includes(theme))theme='system';
function applyTheme(){
  if(theme==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme;
  const light=theme==='light'||(theme==='system'&&matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]').content=light?'#eff1e9':'#101b1b';
}
applyTheme();matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',applyTheme);
document.title=GAME_TITLE;document.querySelectorAll('[data-game-title]').forEach(e=>e.textContent=GAME_TITLE);
document.querySelectorAll('.stat[title]').forEach(e=>e.tabIndex=0);
setupLayout();setupTooltips();setupModalKeyboard();
const render=createRenderer(state,()=>Boolean(modalMode()));
function save(announce=false){const result=saveGame(state);if(!result.ok&&!warnedStorage){toast(result.message,true);warnedStorage=true;}else if(announce)toast(result.message,!result.ok);return result;}
function finish(result){toast(result.message,!result.ok);if(result.ok){addFeed(state,result.message,'Why: this was your business decision. Its income, operating costs, and risks now apply.');save();}render(1000);}
function hideTutorial(){document.getElementById('tutorial').hidden=true;document.querySelectorAll('.tutorial-highlight').forEach(e=>e.classList.remove('tutorial-highlight'));}
const tutorialSteps=[
  {title:'Your first packet.',text:'You own one used server and host three hobby sites. These three numbers tell you how the business is doing.',selector:'.stats'},
  {title:'Build with a reason.',text:'Buy a Budget server for a quick expansion, or save for Standard. Every server uses power, even while empty.',selector:'#server-cards',tab:'build'},
  {title:'People pay the bills.',text:'Sign a hobby site using spare capacity. Only accepted applications incur the onboarding fee. More demanding clients arrive in later chapters.',selector:'#customer-cards',tab:'customers'},
  {title:'Find your price.',text:'Move the pricing slider for a live profit preview. A high rate earns more per client but turns away more applicants.',selector:'#pricing-box',tab:'customers'},
  {title:'Earn the next chapter.',text:'Meet every goal together to unlock your Small Rack. Nothing is unlocked by waiting alone. Open View goals for exact targets.',selector:'#goal-banner',tab:'goals'},
];
function showTutorial(){
  hideTutorial();const step=tutorialSteps[tutorialIndex];
  if(!step){tutorialIndex=-1;state.tutorialDone=true;save();return;}
  if(step.tab)selectTab(step.tab);
  const target=document.querySelector(step.selector);target?.classList.add('tutorial-highlight');
  if(tutorialIndex>0)target?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  document.getElementById('tutorial-step').textContent=`QUICK START · ${tutorialIndex+1} / ${tutorialSteps.length}`;
  document.getElementById('tutorial-title').textContent=step.title;document.getElementById('tutorial-text').textContent=step.text;
  document.querySelector('[data-action="tutorial-next"]').textContent=tutorialIndex===tutorialSteps.length-1?'Start building →':'Next →';
  document.getElementById('tutorial').hidden=false;
}
function openDesk(){hideTutorial();if(state.activeEvent){eventModal(state);return;}menuModal(state,theme);}
function exportModal(){showModal('Your business, backed up.',`<p>Copy this entire code and keep it somewhere safe. It includes your decisions, pending events, and random seed.</p><label class="fine" for="save-code">Portable save code</label><textarea id="save-code" readonly spellcheck="false">${escapeHTML(exportCode(state))}</textarea><button class="primary" data-action="copy" title="Copy the complete save code to your clipboard">Copy save code</button><p class="fine">If clipboard access is blocked, select the text and copy it manually.</p>`,{kind:'export'});}
function importModal(){showModal('Bring your network back.', '<p>Paste a complete save code. A valid import replaces the current run; export first if you want to keep it.</p><label class="fine" for="import-code">Save code</label><textarea id="import-code" spellcheck="false" placeholder="Paste save code here"></textarea><p id="import-error" class="form-error" role="alert"></p><button class="primary" data-action="commit-import" title="Validate this save code and replace the current run">Validate & import</button>',{kind:'import'});}
async function action(name,value){
  switch(name){
    case 'pause':state.paused=!state.paused;save();break;
    case 'speed':if(SPEEDS.includes(Number(value)))state.speed=Number(value);save();break;
    case 'buy':finish(purchaseServer(state,value));break;
    case 'protect':finish(purchaseProtection(state,value));break;
    case 'sign':finish(signCustomer(state,value));break;
    case 'network':case 'location':infrastructureModal(name,value);break;
    case 'commit-network':case 'commit-location':{const result=chooseInfrastructure(state,name.replace('commit-',''),value);closeModal(true);finish(result);break;}
    case 'loan':loanModal(value);break;
    case 'commit-loan':{const result=takeLoan(state,value);closeModal(true);finish(result);break;}
    case 'repay':finish(repayLoan(state,Number(value)));break;
    case 'respond':{const result=resolveEvent(state,value);if(result.ok)closeModal(true);toast(result.message,!result.ok);save();break;}
    case 'tab':selectTab(value,true);break;
    case 'details':{const details=document.getElementById('money-details');details.hidden=!details.hidden;const button=document.getElementById('details-toggle');button.textContent=details.hidden?'Show details ↓':'Hide details ↑';button.setAttribute('aria-expanded',String(!details.hidden));break;}
    case 'menu':openDesk();break;
    case 'close-modal':closeModal();break;
    case 'goals':hideTutorial();goalsModal(state);break;
    case 'save':save(true);break;
    case 'load':showModal('Return to your last save?', '<p>This replaces the current in-memory run with the last local autosave. Export the current game first if you need both.</p><button class="primary" data-action="commit-load" title="Reload the last saved state">Load last save</button>',{kind:'confirm'});break;
    case 'commit-load':{const result=loadGame();if(result.state){replaceState(result.state);closeModal(true);toast('Local save loaded.');}else toast(result.error||'There is no local save yet.',true);break;}
    case 'export':exportModal();break;
    case 'import':importModal();break;
    case 'commit-import':try{const next=importCode(document.getElementById('import-code').value);replaceState(next);closeModal(true);hideTutorial();tutorialIndex=-1;save();toast('Save imported successfully.');}catch(error){document.getElementById('import-error').textContent=error.message;}break;
    case 'copy':{const area=document.getElementById('save-code');area.focus();area.select();try{await navigator.clipboard.writeText(area.value);toast('Save code copied.');}catch{toast('Code selected. Use your device’s Copy command.');}break;}
    case 'help':helpModal();break;
    case 'theme':theme=value;applyTheme();try{localStorage.setItem(THEME_KEY,theme);}catch{toast('Theme changed for this visit. Browser storage is unavailable.',true);}menuModal(state,theme);break;
    case 'reset':showModal('Start from the garage again?', '<p>This permanently replaces your local save and clears this run’s choices. Export a save code first if you want a backup.</p><button class="danger" data-action="commit-reset" title="Confirm resetting this run and its local save">Yes, start a new run</button>',{kind:'confirm'});break;
    case 'commit-reset':replaceState(initialState());closeModal(true);save();tutorialIndex=0;showTutorial();toast('A fresh start. Make the first decision count.');break;
    case 'tutorial-next':tutorialIndex++;showTutorial();break;
    case 'tutorial-skip':tutorialIndex=-1;state.tutorialDone=true;hideTutorial();save();break;
  }
  render(1000);
}
document.addEventListener('click',event=>{const button=event.target.closest('button[data-action]');if(button&&!button.disabled)action(button.dataset.action,button.dataset.value);});
document.getElementById('price').addEventListener('input',event=>{setPrice(state,event.target.value);render(1000);});
document.getElementById('price').addEventListener('change',()=>save());
document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.altKey||event.metaKey||event.repeat||event.target.closest('input,textarea,select,[contenteditable=true]')||modalMode())return;
  const key=event.key.toLowerCase();
  if(key===' '){if(event.target.closest('button,summary,a'))return;event.preventDefault();action('pause');}
  else if(['1','2','3'].includes(key))action('speed',SPEEDS[Number(key)-1]);
  else if(key==='b')selectTab('build',true);else if(key==='c')selectTab('customers',true);else if(key==='m')openDesk();
});
startLoop({render:elapsed=>{render(elapsed);if(state.activeEvent&&modalMode()!=='event'){hideTutorial();eventModal(state);save();}},onUnlock:tier=>{save();toast(`${tier.name} unlocked! ${tier.description}`);const scene=document.getElementById('scene-panel');scene.classList.add('unlock-spark');setTimeout(()=>scene.classList.remove('unlock-spark'),1400);},onVisibility:()=>save(),isBlocked:()=>Boolean(modalMode())});
setInterval(()=>save(),AUTOSAVE_MS);
window.addEventListener('pagehide',()=>save());
render(1000);
if(loaded.error)toast(loaded.error,true);
if(warnedStorage)toast('Browser storage is unavailable. Export a code before leaving.',true);
if(!state.tutorialDone&&!state.activeEvent){tutorialIndex=0;showTutorial();}
