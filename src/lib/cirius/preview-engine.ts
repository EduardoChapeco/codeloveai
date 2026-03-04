/**
 * Cirius Preview Engine v3
 * Robust local preview builder with comprehensive TypeScript stripping,
 * inter-module resolution, and production-quality component stubbing.
 */

// ─── Types ───
interface ModuleInfo {
  path: string;
  code: string;
  deps: string[];
  name: string;
}

// ─── Comprehensive TypeScript stripper ───
// Strips ALL TypeScript-specific syntax to produce valid JS for Babel standalone
function stripTypeScript(code: string): string {
  let result = code;

  // Remove import type / export type statements entirely
  result = result.replace(/^import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "");
  result = result.replace(/^export\s+type\s+[\s\S]*?(?:;|\}\s*$)/gm, "");
  result = result.replace(/^export\s+interface\s+\w+[\s\S]*?^\}/gm, "");

  // Remove standalone interface declarations (multi-line)
  result = result.replace(/^interface\s+\w+[^{]*\{[\s\S]*?^\}/gm, "");

  // Remove standalone type aliases
  result = result.replace(/^type\s+\w+\s*(?:<[^>]*>)?\s*=\s*[\s\S]*?;\s*$/gm, "");

  // Remove type assertions: `as Type` (but not `as const`)
  result = result.replace(/\s+as\s+(?!const\b)[A-Z]\w*(?:<[^>]*>)?/g, "");

  // Remove generic type parameters from function calls and definitions
  // e.g., useState<string>(...) → useState(...)
  // Be careful not to strip JSX: only strip <Type> after identifiers, not after = or return
  result = result.replace(/(\w)\s*<([A-Z]\w*(?:\s*\|\s*\w+)*(?:\s*,\s*[A-Z]\w*)*)>\s*\(/g, "$1(");

  // Remove angle bracket type params from function definitions
  // e.g., function foo<T>(... → function foo(...
  result = result.replace(/(function\s+\w+)\s*<[^>]+>/g, "$1");

  // Remove type annotations from parameters: (param: Type) → (param)
  // Handle complex types like Record<string, any>, React.FC<Props>, etc.
  result = result.replace(/(\w)\s*:\s*(?:React\.(?:FC|Component|ReactNode|CSSProperties|MouseEvent|ChangeEvent|FormEvent)(?:<[^>]*>)?|string|number|boolean|any|void|never|null|undefined|unknown|Record<[^>]*>|Array<[^>]*>|Promise<[^>]*>|Partial<[^>]*>|Omit<[^>]*>|Pick<[^>]*>|\w+(?:\[\])?(?:\s*\|\s*(?:string|number|boolean|null|undefined|\w+(?:\[\])?))*)/g, "$1");

  // Remove remaining simple type annotations in destructured params
  // { prop }: Props → { prop }
  result = result.replace(/\}\s*:\s*(?:Props|[A-Z]\w+(?:Props|Config|Options|State|Context|Data|Type)?)/g, "}");

  // Remove `: React.FC<...> =` patterns  
  result = result.replace(/:\s*React\.FC(?:<[^>]*>)?\s*=/g, " =");

  // Remove return type annotations from functions
  // ): ReturnType { → ) {
  // ): React.ReactNode => → ) =>
  result = result.replace(/\)\s*:\s*(?:React\.(?:ReactNode|ReactElement|JSX\.Element)|JSX\.Element|string|number|boolean|void|any|Promise<[^>]*>|\w+(?:\[\])?)\s*([\{=>])/g, ") $1");

  // Remove non-null assertions
  result = result.replace(/!(?=\.|\[|\))/g, "");

  // Remove `satisfies Type` expressions
  result = result.replace(/\s+satisfies\s+\w+(?:<[^>]*>)?/g, "");

  // Remove `declare` statements
  result = result.replace(/^declare\s+[\s\S]*?;\s*$/gm, "");

  // Remove `readonly` modifiers
  result = result.replace(/\breadonly\s+/g, "");

  // Remove enum declarations (replace with object)
  result = result.replace(/^(?:export\s+)?enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm, (_, name, body) => {
    const entries = body.split(",").map((e: string) => e.trim()).filter(Boolean).map((e: string) => {
      const [k, v] = e.split("=").map((s: string) => s.trim());
      return v ? `${k}: ${v}` : `${k}: "${k}"`;
    });
    return `const ${name} = { ${entries.join(", ")} };`;
  });

  return result;
}

// ─── Fix dynamic JSX component references ───
// NOTE: Babel (react preset) already supports JSX member expressions like <motion.div /> and <f.icon />.
// Agressive regex rewrites were causing malformed output for complex props (spread/nested objects),
// which could blank the preview. Keep this pass intentionally conservative.
function fixDynamicJsx(code: string): string {
  return code;
}

// ─── Safe export transformation ───
function safeTransformExports(code: string, moduleName: string): string {
  let result = code;

  // Remove all import statements
  result = result.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "");
  result = result.replace(/^import\s+['"][^'"]+['"];?\s*$/gm, "");

  // Strip TypeScript before processing exports
  result = stripTypeScript(result);

  // Fix dynamic JSX component references (e.g., <f.icon />)
  result = fixDynamicJsx(result);

  // Handle: export default function Name(...)
  result = result.replace(
    /^export\s+default\s+function\s+(\w+)/gm,
    `window.__ciriusModules["${moduleName}"] = function $1`
  );

  // Handle: export default class Name
  result = result.replace(
    /^export\s+default\s+class\s+(\w+)/gm,
    `window.__ciriusModules["${moduleName}"] = class $1`
  );

  // Handle: export default (expression) — must come after function/class
  result = result.replace(
    /^export\s+default\s+/gm,
    `window.__ciriusModules["${moduleName}"] = `
  );

  // Handle: export function Name(...)
  result = result.replace(
    /^export\s+function\s+(\w+)/gm,
    (_, name) => `window.__ciriusExports["${name}"] = function ${name}`
  );

  // Handle: export const Name = ... (with or without remaining type annotations)
  result = result.replace(
    /^export\s+const\s+(\w+)\s*(?::\s*[^=]*)?\s*=/gm,
    (_, name) => `window.__ciriusExports["${name}"] =`
  );

  // Handle: export let Name = ...
  result = result.replace(
    /^export\s+let\s+(\w+)\s*(?::\s*[^=]*)?\s*=/gm,
    (_, name) => `window.__ciriusExports["${name}"] =`
  );

  // Handle: export { ... } statements — remove them
  result = result.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, "");

  // Handle: export type / export interface — remove (not runtime)
  result = result.replace(/^export\s+(?:type|interface)\s+[\s\S]*?(?:;|\})\s*$/gm, "");

  return result.trim();
}

// ─── Extract component name from path ───
function getComponentName(path: string): string {
  const base = path.split("/").pop()?.replace(/\.(tsx|ts|jsx|js)$/, "") || "Component";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// ─── Extract import dependencies ───
function extractDeps(code: string): string[] {
  const deps: string[] = [];
  const importRe = /^import\s+.*?from\s+['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(code)) !== null) {
    const dep = m[1];
    if (dep.startsWith(".") || dep.startsWith("@/") || dep.startsWith("src/")) {
      deps.push(dep);
    }
  }
  return deps;
}

// ─── Extract imported names from import statements ───
function extractImportedNames(code: string): Map<string, string> {
  const names = new Map<string, string>(); // name → source path
  const re = /^import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const source = m[3];
    if (m[1]) {
      // Named imports: { A, B as C }
      m[1].split(",").forEach(n => {
        const parts = n.trim().split(/\s+as\s+/);
        const localName = (parts[1] || parts[0]).trim();
        if (localName && /^[A-Z]/.test(localName)) names.set(localName, source);
      });
    }
    if (m[2]) {
      // Default import
      if (/^[A-Z]/.test(m[2])) names.set(m[2], source);
    }
  }
  return names;
}

// ─── Resolve import path to file key ───
function resolveImport(from: string, importPath: string, fileKeys: string[]): string | null {
  let resolved: string;

  if (importPath.startsWith("@/")) {
    resolved = "src/" + importPath.slice(2);
  } else if (importPath.startsWith("./") || importPath.startsWith("../")) {
    const fromDir = from.includes("/") ? from.substring(0, from.lastIndexOf("/")) : "";
    const parts = (fromDir ? fromDir + "/" + importPath : importPath).split("/");
    const normalized: string[] = [];
    for (const p of parts) {
      if (p === "." || p === "") continue;
      if (p === "..") normalized.pop();
      else normalized.push(p);
    }
    resolved = normalized.join("/");
  } else {
    resolved = importPath;
  }

  const extensions = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fileKeys.includes(candidate)) return candidate;
  }
  return null;
}

// ─── Topological sort ───
function topoSort(modules: ModuleInfo[], fileKeys: string[]): ModuleInfo[] {
  const graph = new Map<string, Set<string>>();
  const moduleMap = new Map<string, ModuleInfo>();

  for (const mod of modules) {
    moduleMap.set(mod.path, mod);
    const resolvedDeps = new Set<string>();
    for (const dep of mod.deps) {
      const resolved = resolveImport(mod.path, dep, fileKeys);
      if (resolved && resolved !== mod.path) resolvedDeps.add(resolved);
    }
    graph.set(mod.path, resolvedDeps);
  }

  const visited = new Set<string>();
  const result: ModuleInfo[] = [];

  function visit(path: string) {
    if (visited.has(path)) return;
    visited.add(path);
    const deps = graph.get(path) || new Set();
    for (const dep of deps) visit(dep);
    const mod = moduleMap.get(path);
    if (mod) result.push(mod);
  }

  for (const mod of modules) visit(mod.path);
  return result;
}

// ─── Icon stub list ───
const ICON_NAMES = [
  'Menu','X','ChevronDown','ChevronRight','ChevronLeft','ChevronUp','ArrowRight','ArrowLeft',
  'ArrowUp','ArrowDown','Check','Star','Heart','Search','Mail','Phone','MapPin','Clock',
  'Calendar','User','Users','Settings','Home','Globe','Send','MessageSquare','ExternalLink',
  'Github','Linkedin','Twitter','Facebook','Instagram','Sparkles','Zap','Shield','Award',
  'Target','TrendingUp','BarChart','PieChart','Activity','Cpu','Database','Server','Code',
  'Terminal','Layers','Layout','Grid','List','Eye','EyeOff','Lock','Unlock','Plus','Minus',
  'Edit','Trash','Download','Upload','Share','Copy','Bookmark','Flag','Bell','Info',
  'AlertCircle','AlertTriangle','HelpCircle','XCircle','CheckCircle','Loader2','RefreshCw',
  'RotateCw','Play','Pause','Square','Circle','Triangle','Hexagon','Rocket','Flame','Sun',
  'Moon','Cloud','CloudRain','Wind','Droplet','Thermometer','Wifi','WifiOff','Bluetooth',
  'Battery','BatteryCharging','Plug','Power','Volume','VolumeX','Mic','MicOff','Camera',
  'Image','Film','Music','Headphones','Radio','Tv','Monitor','Smartphone','Tablet','Laptop',
  'Watch','Printer','Scanner','Mouse','Keyboard','Gamepad','Joystick','Bot','Brain',
  'Wand2','Palette','PaintBucket','Pipette','Ruler','Scissors','Crop','Move','Maximize',
  'Minimize','MoreHorizontal','MoreVertical','Filter','SortAsc','SortDesc','Inbox','Archive',
  'Folder','FolderOpen','File','FileText','FilePlus','Save','Trash2','LogOut','LogIn',
  'UserPlus','UserMinus','ShoppingCart','ShoppingBag','CreditCard','DollarSign','Percent',
  'Tag','Tags','Gift','Package','Truck','Map','Navigation','Compass','Anchor','Building',
  'Building2','Store','Briefcase','GraduationCap','BookOpen','Library','Newspaper',
];

// ─── Error bridge HTML ───
const ERROR_BRIDGE_SCRIPT = `
<script>
window.__ciriusModules = window.__ciriusModules || {};
window.__ciriusExports = window.__ciriusExports || {};
window.onerror = function(msg, src, line, col, err) {
  var msgStr = String(msg || '');
  if (msgStr === 'Script error.' || msgStr === 'Script error' || !msgStr.trim()) return true;
  var errDiv = document.getElementById('__cirius-error');
  if (!errDiv) {
    errDiv = document.createElement('div');
    errDiv.id = '__cirius-error';
    errDiv.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#1a1020;border-top:2px solid #f43f5e;color:#fda4af;padding:12px 16px;font-family:monospace;font-size:12px;max-height:40vh;overflow:auto;';
    document.body.appendChild(errDiv);
  }
  var srcFile = (src || '').replace(/^.*\\//, '') || 'unknown';
  errDiv.innerHTML += '<div style="margin-bottom:6px"><strong style="color:#f43f5e">⚠ Runtime Error</strong> <span style="color:#94a3b8">(' + srcFile + ':' + (line||'?') + ')</span><br/><span style="color:#e2e8f0">' + msgStr + '</span></div>';
  try { window.parent.postMessage({ type: 'cirius-preview-error', error: msgStr, source: srcFile, line: line }, '*'); } catch(e) {}
  return false;
};
window.addEventListener('unhandledrejection', function(e) {
  var msg = e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled Promise rejection';
  window.onerror(msg, '', 0, 0, null);
});
</script>`;

// ─── UI stubs script ───
function buildStubsScript(): string {
  const iconStubs = ICON_NAMES.map(n => `window["${n}"] = iconStub;`).join("\n");
  return `<script>
// Module system
window.__ciriusModules = {};
window.__ciriusExports = {};

// UI component stubs
window.Button = function(props) { return React.createElement('button', {className: 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ' + (props.className||''), onClick: props.onClick, disabled: props.disabled, type: props.type||'button', style: props.style}, props.children); };
window.Input = function(props) { var p = Object.assign({}, props); delete p.className; return React.createElement('input', Object.assign({className: 'border rounded-lg px-3 py-2 w-full bg-white ' + (props.className||'')}, p)); };
window.Textarea = function(props) { var p = Object.assign({}, props); delete p.className; return React.createElement('textarea', Object.assign({className: 'border rounded-lg px-3 py-2 w-full bg-white ' + (props.className||'')}, p)); };
window.Card = function(props) { return React.createElement('div', {className: 'border rounded-xl p-6 shadow-sm bg-white ' + (props.className||''), style: props.style}, props.children); };
window.CardHeader = function(props) { return React.createElement('div', {className: 'mb-4 ' + (props.className||'')}, props.children); };
window.CardTitle = function(props) { return React.createElement('h3', {className: 'text-lg font-semibold ' + (props.className||'')}, props.children); };
window.CardDescription = function(props) { return React.createElement('p', {className: 'text-sm text-gray-500 ' + (props.className||'')}, props.children); };
window.CardContent = function(props) { return React.createElement('div', {className: props.className||''}, props.children); };
window.CardFooter = function(props) { return React.createElement('div', {className: 'mt-4 pt-4 border-t ' + (props.className||'')}, props.children); };
window.Badge = function(props) { return React.createElement('span', {className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ' + (props.className||'')}, props.children); };
window.Avatar = function(props) { return React.createElement('div', {className: 'w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden ' + (props.className||'')}, props.children); };
window.AvatarImage = function(props) { return React.createElement('img', {src: props.src, alt: props.alt||'', className: 'w-full h-full object-cover'}); };
window.AvatarFallback = function(props) { return React.createElement('span', {className: 'text-sm font-medium text-gray-600'}, props.children); };
window.Separator = function(props) { return React.createElement('hr', {className: 'border-gray-200 my-4 ' + (props.className||'')}); };
window.Switch = function(props) { return React.createElement('button', {className: 'w-11 h-6 rounded-full ' + (props.checked ? 'bg-blue-600' : 'bg-gray-300'), onClick: function() { props.onCheckedChange && props.onCheckedChange(!props.checked); }}, React.createElement('span', {className: 'block w-5 h-5 rounded-full bg-white shadow transform transition-transform ' + (props.checked ? 'translate-x-5' : 'translate-x-0.5')})); };
window.Label = function(props) { return React.createElement('label', {className: 'text-sm font-medium ' + (props.className||''), htmlFor: props.htmlFor}, props.children); };
window.Select = function(props) { return React.createElement('div', null, props.children); };
window.SelectTrigger = function(props) { return React.createElement('button', {className: 'border rounded-lg px-3 py-2 w-full text-left bg-white ' + (props.className||'')}, props.children); };
window.SelectContent = function(props) { return null; };
window.SelectItem = function(props) { return null; };
window.SelectValue = function(props) { return React.createElement('span', null, props.placeholder || ''); };
window.Tabs = function(props) { var defaultVal = props.defaultValue || ''; var val = React.useState(defaultVal); var current = val[0]; var setCurrent = val[1]; return React.createElement('div', {className: props.className||''}, React.Children.map(props.children, function(child) { if (!child || !child.props) return child; if (child.type === window.TabsList) return React.cloneElement(child, { _current: current, _setCurrent: setCurrent }); if (child.type === window.TabsContent) return child.props.value === current ? child : null; return child; })); };
window.TabsList = function(props) { return React.createElement('div', {className: 'flex gap-1 border-b mb-4 ' + (props.className||'')}, React.Children.map(props.children, function(child) { if (!child || !child.props) return child; return React.cloneElement(child, { _current: props._current, _setCurrent: props._setCurrent }); })); };
window.TabsTrigger = function(props) { var isActive = props._current === props.value; return React.createElement('button', {className: 'px-4 py-2 text-sm font-medium border-b-2 transition-colors ' + (isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700') + ' ' + (props.className||''), onClick: function() { if (props._setCurrent) props._setCurrent(props.value); if (props.onClick) props.onClick(); }}, props.children); };
window.TabsContent = function(props) { return React.createElement('div', {className: props.className||''}, props.children); };
window.Dialog = function(props) { return React.createElement('div', null, props.children); };
window.DialogTrigger = function(props) { return React.createElement('div', null, props.children); };
window.DialogContent = function(props) { return null; };
window.DialogHeader = function(props) { return React.createElement('div', null, props.children); };
window.DialogTitle = function(props) { return React.createElement('h2', null, props.children); };
window.DialogDescription = function(props) { return React.createElement('p', null, props.children); };
window.ScrollArea = function(props) { return React.createElement('div', {className: 'overflow-auto ' + (props.className||''), style: props.style}, props.children); };
window.Skeleton = function(props) { return React.createElement('div', {className: 'animate-pulse bg-gray-200 rounded ' + (props.className||'')}); };
window.Progress = function(props) { return React.createElement('div', {className: 'w-full bg-gray-200 rounded-full h-2'}, React.createElement('div', {className: 'bg-blue-600 h-2 rounded-full', style: {width: (props.value||0)+'%'}})); };
window.Tooltip = function(props) { return React.createElement('div', null, props.children); };
window.TooltipTrigger = function(props) { return React.createElement('div', {className: 'inline-flex'}, props.children); };
window.TooltipContent = function(props) { return null; };
window.TooltipProvider = function(props) { return React.createElement('div', null, props.children); };
window.Accordion = function(props) { return React.createElement('div', {className: props.className||''}, props.children); };
window.AccordionItem = function(props) { var open = React.useState(false); return React.createElement('div', {className: 'border-b'}, React.Children.map(props.children, function(c) { if (!c) return c; return React.cloneElement(c, { _open: open[0], _toggle: function() { open[1](!open[0]); } }); })); };
window.AccordionTrigger = function(props) { return React.createElement('button', {className: 'flex w-full justify-between py-4 font-medium', onClick: props._toggle}, props.children, React.createElement('span', {className: 'transform transition-transform ' + (props._open ? 'rotate-180' : '')}, '▼')); };
window.AccordionContent = function(props) { return props._open ? React.createElement('div', {className: 'pb-4'}, props.children) : null; };
window.DropdownMenu = function(props) { return React.createElement('div', {className: 'relative inline-block'}, props.children); };
window.DropdownMenuTrigger = function(props) { return React.createElement('div', null, props.children); };
window.DropdownMenuContent = function(props) { return null; };
window.DropdownMenuItem = function(props) { return null; };
window.Sheet = function(props) { return React.createElement('div', null, props.children); };
window.SheetTrigger = function(props) { return React.createElement('div', null, props.children); };
window.SheetContent = function(props) { return null; };
window.Popover = function(props) { return React.createElement('div', {className: 'relative inline-block'}, props.children); };
window.PopoverTrigger = function(props) { return React.createElement('div', null, props.children); };
window.PopoverContent = function(props) { return null; };
window.Checkbox = function(props) { return React.createElement('input', {type: 'checkbox', checked: props.checked, onChange: function(e) { if(props.onCheckedChange) props.onCheckedChange(e.target.checked); }, className: 'w-4 h-4 rounded border-gray-300'}); };
window.RadioGroup = function(props) { return React.createElement('div', {className: 'flex flex-col gap-2 ' + (props.className||'')}, props.children); };
window.RadioGroupItem = function(props) { return React.createElement('input', {type: 'radio', value: props.value, className: 'w-4 h-4'}); };
window.Slider = function(props) { return React.createElement('input', {type: 'range', min: props.min||0, max: props.max||100, className: 'w-full'}); };
window.Table = function(props) { return React.createElement('table', {className: 'w-full border-collapse ' + (props.className||'')}, props.children); };
window.TableHeader = function(props) { return React.createElement('thead', null, props.children); };
window.TableBody = function(props) { return React.createElement('tbody', null, props.children); };
window.TableRow = function(props) { return React.createElement('tr', {className: 'border-b ' + (props.className||'')}, props.children); };
window.TableHead = function(props) { return React.createElement('th', {className: 'px-4 py-3 text-left text-sm font-medium text-gray-500 ' + (props.className||'')}, props.children); };
window.TableCell = function(props) { return React.createElement('td', {className: 'px-4 py-3 text-sm ' + (props.className||'')}, props.children); };
window.Collapsible = function(props) { return React.createElement('div', null, props.children); };
window.CollapsibleTrigger = function(props) { return React.createElement('div', null, props.children); };
window.CollapsibleContent = function(props) { return React.createElement('div', null, props.children); };
window.HoverCard = function(props) { return React.createElement('div', null, props.children); };
window.HoverCardTrigger = function(props) { return React.createElement('div', null, props.children); };
window.HoverCardContent = function(props) { return null; };

// Navigation stubs
window.Link = function(props) { return React.createElement('a', {href: props.to || props.href || '#', className: props.className||'', style: props.style, onClick: function(e) { e.preventDefault(); if(props.onClick) props.onClick(e); }}, props.children); };
window.NavLink = function(props) { return React.createElement('a', {href: props.to || '#', className: (typeof props.className === 'function' ? props.className({isActive: false}) : props.className) || ''}, props.children); };
window.useNavigate = function() { return function(path) { console.log('[nav]', path); }; };
window.useParams = function() { return {}; };
window.useLocation = function() { return { pathname: '/', search: '', hash: '', state: null }; };
window.useSearchParams = function() { return [new URLSearchParams(), function(){}]; };
window.BrowserRouter = function(props) { return React.createElement('div', null, props.children); };
window.Routes = function(props) { 
  var children = React.Children.toArray(props.children);
  return children.length > 0 ? React.createElement('div', null, children[0]) : null;
};
window.Route = function(props) { return props.element || null; };
window.Outlet = function() { return null; };

// React hooks stubs
window.useState = React.useState;
window.useEffect = React.useEffect;
window.useRef = React.useRef;
window.useCallback = React.useCallback;
window.useMemo = React.useMemo;
window.useContext = React.useContext;
window.createContext = React.createContext;
window.forwardRef = React.forwardRef;
window.memo = React.memo;

// Utility stubs
window.cn = function() { return Array.from(arguments).filter(Boolean).join(' '); };
window.clsx = window.cn;
window.cva = function(base) { return function(props) { return base; }; };
window.toast = function(msg) { console.log('[toast]', typeof msg === 'object' ? JSON.stringify(msg) : msg); };
window.useToast = function() { return { toast: window.toast, dismiss: function(){} }; };
window.Toaster = function() { return null; };
window.sonner = { toast: window.toast };

// Icon stubs
var iconStub = function(props) { 
  var s = props.size || props.width || 16;
  return React.createElement('svg', {
    width: s, height: s, viewBox: '0 0 24 24', fill: 'none', 
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    className: props.className || '', style: props.style,
    onClick: props.onClick
  }, React.createElement('circle', {cx:12, cy:12, r:10}));
};
${iconStubs}

// Framer motion stubs
window.motion = new Proxy({}, { get: function(_, tag) { return React.forwardRef(function(props, ref) { var p = Object.assign({}, props); delete p.initial; delete p.animate; delete p.exit; delete p.transition; delete p.whileHover; delete p.whileTap; delete p.whileInView; delete p.variants; delete p.layout; delete p.layoutId; p.ref = ref; return React.createElement(tag, p); }); } });
window.AnimatePresence = function(props) { return React.createElement(React.Fragment, null, props.children); };
window.useAnimation = function() { return { start: function(){}, stop: function(){} }; };
window.useInView = function() { return [React.useRef(null), true]; };
window.useScroll = function() { return { scrollY: { get: function(){ return 0; } }, scrollYProgress: { get: function(){ return 0; } } }; };
window.useTransform = function(v, i, o) { return { get: function(){ return o ? o[0] : 0; } }; };
window.useSpring = function(v) { return v; };
window.useMotionValue = function(v) { return { get: function(){ return v; }, set: function(){} }; };

// Date-fns stubs
window.format = function(d, f) { try { return new Date(d).toLocaleDateString(); } catch(e) { return String(d); } };
window.formatDistance = function(a, b) { return 'some time ago'; };
window.formatRelative = function(a, b) { return 'recently'; };
window.parseISO = function(s) { return new Date(s); };
window.isValid = function(d) { return d instanceof Date && !isNaN(d); };
window.addDays = function(d, n) { var r = new Date(d); r.setDate(r.getDate()+n); return r; };
window.subDays = function(d, n) { var r = new Date(d); r.setDate(r.getDate()-n); return r; };
window.startOfWeek = function(d) { return new Date(d); };
window.endOfWeek = function(d) { return new Date(d); };
window.startOfMonth = function(d) { return new Date(d); };
window.endOfMonth = function(d) { return new Date(d); };
window.differenceInDays = function(a, b) { return Math.round((new Date(a) - new Date(b)) / 86400000); };
window.isBefore = function(a, b) { return new Date(a) < new Date(b); };
window.isAfter = function(a, b) { return new Date(a) > new Date(b); };

// Zod stubs
var zodChain = {};
['string','number','boolean','object','array','enum','min','max','email','optional','nullable','default','url','uuid','regex','trim','nonempty','positive','negative','int','finite','nonnegative','describe','refine','transform','pipe','catch'].forEach(function(m) { zodChain[m] = function() { return zodChain; }; });
zodChain.parse = function(v) { return v; };
zodChain.safeParse = function(v) { return {success:true,data:v}; };
window.z = zodChain;

// React Hook Form stubs
window.useForm = function(opts) { 
  var vals = (opts && opts.defaultValues) || {};
  return { 
    register: function(name) { return { name: name, onChange: function(){}, onBlur: function(){}, ref: function(){} }; },
    handleSubmit: function(fn) { return function(e) { if(e && e.preventDefault) e.preventDefault(); fn(vals); }; },
    watch: function(n) { return n ? vals[n] : vals; },
    setValue: function(n, v) { vals[n] = v; },
    getValues: function() { return vals; },
    reset: function() {},
    formState: { errors: {}, isSubmitting: false, isDirty: false, isValid: true },
    control: {},
  };
};
window.Controller = function(props) { return props.render ? props.render({ field: { value: '', onChange: function(){} }, fieldState: { error: null } }) : null; };
window.FormProvider = function(props) { return React.createElement('div', null, props.children); };
window.useFormContext = function() { return window.useForm(); };

// React Query stubs
window.useQuery = function(opts) { return { data: opts && opts.initialData || undefined, isLoading: false, error: null, refetch: function(){}, isFetching: false, isError: false, isSuccess: true }; };
window.useMutation = function(opts) { return { mutate: function(v) { if(opts && opts.onSuccess) opts.onSuccess(v); }, mutateAsync: function(v){ return Promise.resolve(v); }, isLoading: false, isPending: false, isError: false }; };
window.useQueryClient = function() { return { invalidateQueries: function(){}, setQueryData: function(){} }; };
window.QueryClient = function() { return { invalidateQueries: function(){}, setQueryData: function(){} }; };
window.QueryClientProvider = function(props) { return React.createElement('div', null, props.children); };

// Recharts stubs
var rechartsStub = function(props) { return React.createElement('div', {className: 'w-full h-64 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-sm', style: props.style}, props.children || '[Chart]'); };
['AreaChart','BarChart','LineChart','PieChart','RadarChart','ComposedChart','ResponsiveContainer','XAxis','YAxis','CartesianGrid','Area','Bar','Line','Pie','Cell','Legend','RechartsTooltip','RadialBarChart','RadialBar','Treemap','Funnel','FunnelChart','Scatter','ScatterChart'].forEach(function(n) { window[n] = rechartsStub; });
window.Tooltip = window.Tooltip; // Keep UI tooltip, not recharts

// Supabase stub
window.supabase = { from: function(table) { var chain = { select: function() { return chain; }, insert: function() { return chain; }, update: function() { return chain; }, delete: function() { return chain; }, upsert: function() { return chain; }, eq: function() { return chain; }, neq: function() { return chain; }, gt: function() { return chain; }, gte: function() { return chain; }, lt: function() { return chain; }, lte: function() { return chain; }, in: function() { return chain; }, like: function() { return chain; }, ilike: function() { return chain; }, is: function() { return chain; }, order: function() { return chain; }, limit: function() { return chain; }, range: function() { return chain; }, single: function() { return { data: null, error: null }; }, maybeSingle: function() { return { data: null, error: null }; }, then: function(fn) { return Promise.resolve({ data: [], error: null }).then(fn); }, data: [], error: null }; return chain; }, auth: { getUser: function() { return Promise.resolve({ data: { user: null } }); }, getSession: function() { return Promise.resolve({ data: { session: null } }); }, signInWithPassword: function() { return Promise.resolve({ data: null, error: null }); }, signUp: function() { return Promise.resolve({ data: null, error: null }); }, signOut: function() { return Promise.resolve({ error: null }); }, signInWithOAuth: function() { return Promise.resolve({ data: null, error: null }); }, onAuthStateChange: function(cb) { return { data: { subscription: { unsubscribe: function(){} } } }; } }, functions: { invoke: function() { return Promise.resolve({ data: null, error: null }); } }, storage: { from: function() { return { upload: function() { return Promise.resolve({ data: null, error: null }); }, getPublicUrl: function() { return { data: { publicUrl: '' } }; }, list: function() { return Promise.resolve({ data: [], error: null }); }, remove: function() { return Promise.resolve({ data: null, error: null }); } }; } }, channel: function() { return { on: function() { return this; }, subscribe: function() { return this; } }; }, removeChannel: function() {} };

// createClient stub
window.createClient = function() { return window.supabase; };
</script>`;
}

// ─── Strip markdown code fences from file content ───
function stripMarkdownFences(content: string): string {
  let c = content.trim();
  if (/^```\w*\s*\n/.test(c)) c = c.replace(/^```\w*\s*\n/, "");
  if (/\n```\s*$/.test(c)) c = c.replace(/\n```\s*$/, "");
  return c.trim();
}

// ─── Convert @tailwind/@apply CSS to raw CSS for CDN compatibility ───
function convertTailwindCssToRaw(css: string): string {
  let result = css;
  result = result.replace(/@tailwind\s+(base|components|utilities)\s*;/g, "");
  result = result.replace(/@layer\s+\w+\s*\{/g, "");
  result = result.replace(/\s*@apply\s+[^;]+;/g, "");
  return result;
}

// ─── Main builder ───
export function buildPreviewFromFiles(files: Record<string, string>): string | null {
  if (!files || Object.keys(files).length === 0) return null;

  // Sanitize all file contents
  const cleanFiles: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    cleanFiles[k] = stripMarkdownFences(v);
  }

  const html = cleanFiles["index.html"] || cleanFiles["dist/index.html"];
  const cssFiles = Object.entries(cleanFiles).filter(([k]) => k.endsWith(".css")).map(([k, v]) => [k, convertTailwindCssToRaw(v)] as [string, string]);
  const plainJs = Object.entries(cleanFiles).filter(([k]) => k.endsWith(".js") && !k.includes("node_modules"));

  const hasViteModuleEntry = !!html && /<script[^>]+type=["']module["'][^>]+src=["'][^"']*(?:\/src\/main\.(?:tsx|ts|jsx|js)|\/main\.(?:tsx|ts|jsx|js))[^"']*["'][^>]*>/i.test(html);

  // Static HTML project
  if (html && !hasViteModuleEntry) {
    let assembled = html;
    if (cssFiles.length > 0) {
      const cssBlock = cssFiles.map(([, v]) => `<style>${v}</style>`).join("\n");
      assembled = assembled.includes("</head>")
        ? assembled.replace("</head>", `${cssBlock}\n</head>`)
        : `${cssBlock}\n${assembled}`;
    }
    if (plainJs.length > 0) {
      const jsBlock = plainJs.map(([, v]) => `<script>${v}<\/script>`).join("\n");
      assembled = assembled.includes("</body>")
        ? assembled.replace("</body>", `${jsBlock}\n</body>`)
        : `${assembled}\n${jsBlock}`;
    }
    if (!assembled.includes("cdn.tailwindcss.com") && /class="[^"]*(?:flex|grid|bg-|text-|p-|m-|rounded|shadow)/.test(assembled)) {
      assembled = assembled.includes("</head>")
        ? assembled.replace("</head>", `<script src="https://cdn.tailwindcss.com"><\/script>\n</head>`)
        : `<script src="https://cdn.tailwindcss.com"><\/script>\n${assembled}`;
    }
    return assembled;
  }

  // React/Vite project — build via Babel Standalone
  const sourceModules = Object.entries(cleanFiles).filter(([k]) => {
    if (!k.startsWith("src/")) return false;
    if (k.includes(".d.ts")) return false;
    if (k.endsWith(".css")) return false;
    if (/\/main\.(tsx|ts|jsx|js)$/.test(k)) return false;
    return /\.(tsx|ts|jsx|js)$/.test(k);
  });

  if (sourceModules.length === 0) return html || null;

  const fileKeys = Object.keys(cleanFiles);
  const cssBlock = cssFiles.map(([, v]) => `<style>${v}</style>`).join("\n");

  // Build module info with import analysis
  const modules: ModuleInfo[] = sourceModules.map(([path, code]) => ({
    path,
    code,
    deps: extractDeps(code),
    name: getComponentName(path),
  }));

  // Build import graph for cross-module resolution
  const importGraph = new Map<string, Map<string, string>>(); // file → (localName → sourcePath)
  for (const mod of modules) {
    importGraph.set(mod.path, extractImportedNames(mod.code));
  }

  // Topological sort
  const sorted = topoSort(modules, fileKeys);

  // Transform each module
  const componentScripts = sorted
    .map(mod => {
      const transformed = safeTransformExports(mod.code, mod.path);
      return `<script type="text/babel" data-presets="typescript,react">\n// --- ${mod.path} ---\n${transformed}\n<\/script>`;
    })
    .join("\n");

  // Determine root component
  const appEntry = sorted.find(m => /App\.(tsx|ts|jsx|js)$/.test(m.path));
  const rootModulePath = appEntry?.path || sorted[sorted.length - 1]?.path;
  const rootName = rootModulePath ? getComponentName(rootModulePath) : "App";

  const titleMatch = html?.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || "Preview";

  const fontLinks: string[] = [];
  if (html) {
    const linkMatches = html.match(/<link[^>]*href="[^"]*fonts[^"]*"[^>]*>/gi) || [];
    fontLinks.push(...linkMatches);
    const preconnectMatches = html.match(/<link[^>]*rel="preconnect"[^>]*>/gi) || [];
    fontLinks.push(...preconnectMatches);
  }
  const fontBlock = fontLinks.length > 0 ? fontLinks.join("\n") : `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />`;

  // Build inter-module resolution map
  // Maps: for each file, which names it imports from which resolved paths
  const moduleResolutionScript = buildModuleResolutionScript(sorted, importGraph, fileKeys);

  return `<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<script>
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
};
<\/script>
<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
${fontBlock}
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; }
#root { min-height: 100vh; }
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --radius: 0.5rem;
}
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 48%;
  --radius: 0.5rem;
}
</style>
${cssBlock}
</head>
<body>
<div id="root"><div style="display:flex;align-items:center;justify-content:center;min-height:100vh;color:#888;font-family:Inter,sans-serif;font-size:14px;">Carregando preview...</div></div>
${ERROR_BRIDGE_SCRIPT}
${buildStubsScript()}
${componentScripts}
<script type="text/babel" data-presets="typescript,react">
// --- Inter-module resolution & mount ---
var mods = window.__ciriusModules;
var exps = window.__ciriusExports;

${moduleResolutionScript}

// Fallback: promote all named exports to window globals
Object.keys(exps).forEach(function(name) {
  if (!window[name]) window[name] = exps[name];
});

var RootComp = mods["${rootModulePath || ""}"] || exps["${rootName}"] || window.${rootName} || window.App || function() { 
  return React.createElement('div', {
    style: {display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',fontFamily:'Inter,sans-serif'}
  }, React.createElement('div', {style:{textAlign:'center',color:'#fff'}},
    React.createElement('div', {style:{fontSize:48,marginBottom:16}}, '✨'),
    React.createElement('h2', {style:{fontSize:24,fontWeight:700,marginBottom:8}}, 'Projeto criado!'),
    React.createElement('p', {style:{fontSize:14,opacity:0.8}}, 'Use o chat para adicionar funcionalidades.')
  ));
};
try {
  var root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(RootComp));
} catch(e) {
  window.onerror('Mount error: ' + e.message, 'root-mount', 0, 0, e);
}
<\/script>
</body>
</html>`;
}

// ─── Build inter-module resolution script ───
function buildModuleResolutionScript(
  sorted: ModuleInfo[],
  importGraph: Map<string, Map<string, string>>,
  fileKeys: string[],
): string {
  const lines: string[] = [];
  const allPaths = sorted.map(m => m.path);

  // Step 1: Auto-bind named exports as module defaults where no default exists
  lines.push(`var allPaths = ${JSON.stringify(allPaths)};`);
  lines.push(`allPaths.forEach(function(p) {
  if (!mods[p]) {
    var base = p.split('/').pop().replace(/\\.(tsx|ts|jsx|js)$/, '');
    var capName = base.charAt(0).toUpperCase() + base.slice(1);
    if (exps[capName]) { mods[p] = exps[capName]; }
    else if (exps[base]) { mods[p] = exps[base]; }
  }
});`);

  // Step 2: Cross-module named import resolution
  // For each module, check what it imports and bind those names to window
  for (const mod of sorted) {
    const imports = importGraph.get(mod.path);
    if (!imports || imports.size === 0) continue;

    for (const [localName, sourcePath] of imports) {
      const resolved = resolveImport(mod.path, sourcePath, fileKeys);
      if (!resolved) continue;

      // If importing a name that exists in exports, bind it
      lines.push(`if (!window["${localName}"]) {
  if (exps["${localName}"]) window["${localName}"] = exps["${localName}"];
  else if (mods["${resolved}"]) window["${localName}"] = mods["${resolved}"];
}`);
    }
  }

  return lines.join("\n");
}
