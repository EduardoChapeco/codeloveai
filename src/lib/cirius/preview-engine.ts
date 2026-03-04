/**
 * Cirius Preview Engine v2
 * Robust local preview builder that replaces the fragile regex-based cleanComponent.
 * 
 * Key improvements:
 * - Safe TypeScript export transformation (handles typed exports correctly)
 * - Module registration system (window.__ciriusModules)
 * - Import alias resolution (@/ → src/)
 * - Topological dependency ordering
 * - Error bridge (postMessage to host)
 * - External library stubs (lucide-react icons, shadcn/ui, etc.)
 */

// ─── Types ───
interface ModuleInfo {
  path: string;
  code: string;
  deps: string[];
  name: string;
}

// ─── Safe export transformation ───
// This replaces the broken regex that turned `export const X: React.FC = ...`
// into `window.X = : React.FC = ...` (invalid JS)
function safeTransformExports(code: string, moduleName: string): string {
  let result = code;

  // Remove all import statements (Babel handles resolution via stubs)
  result = result.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "");
  result = result.replace(/^import\s+['"][^'"]+['"];?\s*$/gm, "");

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

  // Handle: export default (expression)
  result = result.replace(
    /^export\s+default\s+/gm,
    `window.__ciriusModules["${moduleName}"] = `
  );

  // Handle: export function Name(...)
  result = result.replace(
    /^export\s+function\s+(\w+)/gm,
    (_, name) => `window.__ciriusExports["${name}"] = function ${name}`
  );

  // Handle: export const Name: Type = ... (THE CRITICAL FIX)
  // Must strip the type annotation to produce valid JS
  result = result.replace(
    /^export\s+const\s+(\w+)\s*:\s*[^=]+=\s*/gm,
    (_, name) => `window.__ciriusExports["${name}"] = `
  );

  // Handle: export const Name = ... (no type annotation)
  result = result.replace(
    /^export\s+const\s+(\w+)\s*=/gm,
    (_, name) => `window.__ciriusExports["${name}"] = `
  );

  // Handle: export let Name = ...
  result = result.replace(
    /^export\s+let\s+(\w+)\s*:\s*[^=]+=\s*/gm,
    (_, name) => `window.__ciriusExports["${name}"] = `
  );
  result = result.replace(
    /^export\s+let\s+(\w+)\s*=/gm,
    (_, name) => `window.__ciriusExports["${name}"] = `
  );

  // Handle: export { ... } statements — remove them
  result = result.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, "");

  // Handle: export type / export interface — remove (not runtime)
  result = result.replace(/^export\s+(?:type|interface)\s+[\s\S]*?(?:;|\})\s*$/gm, "");

  // Strip remaining TypeScript type annotations that Babel might miss
  // Remove `: React.FC<...>` patterns after variable names
  result = result.replace(/:\s*React\.FC(?:<[^>]*>)?\s*=/g, " =");
  result = result.replace(/:\s*React\.FC(?:<[^>]*>)?\s*$/gm, "");

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
    // Only track local deps (not node_modules)
    if (dep.startsWith(".") || dep.startsWith("@/") || dep.startsWith("src/")) {
      deps.push(dep);
    }
  }
  return deps;
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

  // Try exact match, then with extensions
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
    for (const dep of deps) {
      visit(dep);
    }
    const mod = moduleMap.get(path);
    if (mod) result.push(mod);
  }

  for (const mod of modules) {
    visit(mod.path);
  }

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
  // Skip generic cross-origin errors — not actionable
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
window.Tabs = function(props) { return React.createElement('div', {className: props.className||''}, props.children); };
window.TabsList = function(props) { return React.createElement('div', {className: 'flex gap-1 border-b mb-4 ' + (props.className||'')}, props.children); };
window.TabsTrigger = function(props) { return React.createElement('button', {className: 'px-4 py-2 text-sm font-medium ' + (props.className||''), onClick: props.onClick}, props.children); };
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
window.TooltipTrigger = function(props) { return React.createElement('div', null, props.children); };
window.TooltipContent = function(props) { return null; };
window.TooltipProvider = function(props) { return React.createElement('div', null, props.children); };
window.Accordion = function(props) { return React.createElement('div', {className: props.className||''}, props.children); };
window.AccordionItem = function(props) { return React.createElement('div', {className: 'border-b'}, props.children); };
window.AccordionTrigger = function(props) { return React.createElement('button', {className: 'flex w-full justify-between py-4 font-medium'}, props.children); };
window.AccordionContent = function(props) { return React.createElement('div', {className: 'pb-4'}, props.children); };
window.DropdownMenu = function(props) { return React.createElement('div', null, props.children); };
window.DropdownMenuTrigger = function(props) { return React.createElement('div', null, props.children); };
window.DropdownMenuContent = function(props) { return null; };
window.DropdownMenuItem = function(props) { return null; };
window.Sheet = function(props) { return React.createElement('div', null, props.children); };
window.SheetTrigger = function(props) { return React.createElement('div', null, props.children); };
window.SheetContent = function(props) { return null; };

// Navigation stubs
window.Link = function(props) { return React.createElement('a', {href: props.to || props.href || '#', className: props.className||'', style: props.style, onClick: function(e) { e.preventDefault(); if(props.onClick) props.onClick(e); }}, props.children); };
window.useNavigate = function() { return function() {}; };
window.useParams = function() { return {}; };
window.useLocation = function() { return { pathname: '/', search: '', hash: '' }; };
window.useSearchParams = function() { return [new URLSearchParams(), function(){}]; };
window.BrowserRouter = function(props) { return React.createElement('div', null, props.children); };
window.Routes = function(props) { 
  var children = React.Children.toArray(props.children);
  return children.length > 0 ? React.createElement('div', null, children[0]) : null;
};
window.Route = function(props) { return props.element || null; };
window.Outlet = function() { return null; };

// React hooks stubs for common patterns
window.useState = React.useState;
window.useEffect = React.useEffect;
window.useRef = React.useRef;
window.useCallback = React.useCallback;
window.useMemo = React.useMemo;

// Utility stubs
window.cn = function() { return Array.from(arguments).filter(Boolean).join(' '); };
window.clsx = window.cn;
window.cva = function(base) { return function(props) { return base; }; };
window.toast = function(msg) { console.log('[toast]', msg); };
window.useToast = function() { return { toast: window.toast }; };

// Recharts stubs
var rechartsStub = function(props) { return React.createElement('div', {className: 'w-full h-64 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-sm', style: props.style}, props.children || '[Chart]'); };
['AreaChart','BarChart','LineChart','PieChart','RadarChart','ComposedChart','ResponsiveContainer','XAxis','YAxis','CartesianGrid','Area','Bar','Line','Pie','Cell','Legend','RechartsTooltip','RadialBarChart','RadialBar','Treemap','Funnel','FunnelChart','Scatter','ScatterChart'].forEach(function(n) { window[n] = rechartsStub; });
window.Tooltip = window.Tooltip; // Keep UI tooltip, not recharts

// Icon stubs
var iconStub = function(props) { 
  var s = props.size || 16;
  return React.createElement('svg', {
    width: s, height: s, viewBox: '0 0 24 24', fill: 'none', 
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    className: props.className || '', style: props.style,
    onClick: props.onClick
  }, React.createElement('circle', {cx:12, cy:12, r:10}));
};
${iconStubs}

// Framer motion stubs
window.motion = new Proxy({}, { get: function(_, tag) { return function(props) { var p = Object.assign({}, props); delete p.initial; delete p.animate; delete p.exit; delete p.transition; delete p.whileHover; delete p.whileTap; delete p.whileInView; delete p.variants; delete p.layout; return React.createElement(tag, p); }; } });
window.AnimatePresence = function(props) { return React.createElement(React.Fragment, null, props.children); };
window.useAnimation = function() { return { start: function(){}, stop: function(){} }; };
window.useInView = function() { return [null, true]; };

// Date-fns stubs
window.format = function(d, f) { try { return new Date(d).toLocaleDateString(); } catch(e) { return String(d); } };
window.formatDistance = function(a, b) { return 'some time ago'; };
window.parseISO = function(s) { return new Date(s); };
window.isValid = function(d) { return d instanceof Date && !isNaN(d); };
window.addDays = function(d, n) { var r = new Date(d); r.setDate(r.getDate()+n); return r; };
window.subDays = function(d, n) { var r = new Date(d); r.setDate(r.getDate()-n); return r; };
window.startOfWeek = function(d) { return new Date(d); };
window.endOfWeek = function(d) { return new Date(d); };
window.startOfMonth = function(d) { return new Date(d); };
window.endOfMonth = function(d) { return new Date(d); };

// Zod stubs
window.z = {
  string: function() { return window.z; },
  number: function() { return window.z; },
  boolean: function() { return window.z; },
  object: function(s) { return { parse: function(v) { return v; }, safeParse: function(v) { return {success:true,data:v}; } }; },
  array: function() { return window.z; },
  enum: function() { return window.z; },
  min: function() { return window.z; },
  max: function() { return window.z; },
  email: function() { return window.z; },
  optional: function() { return window.z; },
  nullable: function() { return window.z; },
  default: function() { return window.z; },
  parse: function(v) { return v; },
  safeParse: function(v) { return {success:true,data:v}; },
};

// React Query stubs
window.useQuery = function(opts) { return { data: undefined, isLoading: false, error: null, refetch: function(){} }; };
window.useMutation = function(opts) { return { mutate: function(){}, mutateAsync: function(){ return Promise.resolve(); }, isLoading: false, isPending: false }; };
window.QueryClient = function() { return {}; };
window.QueryClientProvider = function(props) { return React.createElement('div', null, props.children); };

// Supabase stub
window.supabase = { from: function() { return { select: function() { return { data: [], error: null, eq: function() { return this; }, order: function() { return this; }, limit: function() { return this; }, single: function() { return { data: null, error: null }; }, maybeSingle: function() { return { data: null, error: null }; } }; }, insert: function() { return { data: null, error: null }; }, update: function() { return { eq: function() { return { data: null, error: null }; } }; }, delete: function() { return { eq: function() { return { data: null, error: null }; } }; } }; }, auth: { getUser: function() { return { data: { user: null } }; }, signInWithPassword: function() { return { data: null, error: null }; }, signUp: function() { return { data: null, error: null }; }, signOut: function() { return { error: null }; }, onAuthStateChange: function(cb) { return { data: { subscription: { unsubscribe: function(){} } } }; } }, functions: { invoke: function() { return Promise.resolve({ data: null, error: null }); } }, storage: { from: function() { return { upload: function() { return { data: null, error: null }; }, getPublicUrl: function() { return { data: { publicUrl: '' } }; } }; } } };
</script>`;
}

// ─── Strip markdown code fences from file content ───
function stripMarkdownFences(content: string): string {
  let c = content.trim();
  // Remove opening fence: ```lang\n or ```\n
  if (/^```\w*\s*\n/.test(c)) {
    c = c.replace(/^```\w*\s*\n/, "");
  }
  // Remove closing fence: \n```
  if (/\n```\s*$/.test(c)) {
    c = c.replace(/\n```\s*$/, "");
  }
  return c.trim();
}

// ─── Convert @tailwind/@apply CSS to raw CSS for CDN compatibility ───
function convertTailwindCssToRaw(css: string): string {
  let result = css;
  // Remove @tailwind directives (CDN handles these)
  result = result.replace(/@tailwind\s+(base|components|utilities)\s*;/g, "");
  // Remove @layer wrappers but keep content
  result = result.replace(/@layer\s+\w+\s*\{/g, "");
  // Remove @apply directives (can't be processed by CDN)
  result = result.replace(/\s*@apply\s+[^;]+;/g, "");
  // Clean up empty blocks and extra closing braces from @layer removal
  // This is imperfect but handles common cases
  return result;
}

// ─── Main builder ───
export function buildPreviewFromFiles(files: Record<string, string>): string | null {
  if (!files || Object.keys(files).length === 0) return null;

  // Sanitize all file contents: strip markdown fences
  const sanitized: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    sanitized[k] = stripMarkdownFences(v);
  }
  // Replace files reference with sanitized version
  const cleanFiles = sanitized;

  const html = cleanFiles["index.html"] || cleanFiles["dist/index.html"];
  const cssFiles = Object.entries(cleanFiles).filter(([k]) => k.endsWith(".css")).map(([k, v]) => [k, convertTailwindCssToRaw(v)] as [string, string]);
  const plainJs = Object.entries(cleanFiles).filter(([k]) => k.endsWith(".js") && !k.includes("node_modules"));

  // Check if HTML uses Vite module entry
  const hasViteModuleEntry = !!html && /<script[^>]+type=["']module["'][^>]+src=["'][^"']*(?:\/src\/main\.(?:tsx|ts|jsx|js)|\/main\.(?:tsx|ts|jsx|js))[^"']*["'][^>]*>/i.test(html);

  // Static HTML project (no React/Vite)
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
    // Inject Tailwind CDN if classes are used
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

  // Build module info
  const modules: ModuleInfo[] = sourceModules.map(([path, code]) => ({
    path,
    code,
    deps: extractDeps(code),
    name: getComponentName(path),
  }));

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

  // Extract custom font links from original HTML
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
</style>
${cssBlock}
</head>
<body>
<div id="root"></div>
${ERROR_BRIDGE_SCRIPT}
${buildStubsScript()}
${componentScripts}
<script type="text/babel" data-presets="typescript,react">
// --- Auto-bind named exports as module defaults & cross-module resolution ---
var mods = window.__ciriusModules;
var exps = window.__ciriusExports;

// Auto-bind: if a module has no default but has named exports, create a namespace default
var allPaths = ${JSON.stringify(sorted.map(m => m.path))};
allPaths.forEach(function(p) {
  if (!mods[p]) {
    // Try to find a matching named export from the component name
    var base = p.split('/').pop().replace(/\\.(tsx|ts|jsx|js)$/, '');
    var capName = base.charAt(0).toUpperCase() + base.slice(1);
    if (exps[capName]) { mods[p] = exps[capName]; }
    else if (exps[base]) { mods[p] = exps[base]; }
  }
});

// Resolve @/ alias imports: bind window globals for any named export
Object.keys(exps).forEach(function(name) {
  if (!window[name]) window[name] = exps[name];
});

var RootComp = mods["${rootModulePath || ""}"] || exps["${rootName}"] || window.${rootName} || window.App || function() { 
  return React.createElement('div', {
    style: {display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f8fafc',fontFamily:'Inter,sans-serif'}
  }, React.createElement('div', {style:{textAlign:'center',color:'#64748b'}},
    React.createElement('div', {style:{fontSize:48,marginBottom:16}}, '✨'),
    React.createElement('h2', {style:{fontSize:20,fontWeight:600,color:'#334155',marginBottom:8}}, 'Preview pronto'),
    React.createElement('p', {style:{fontSize:14}}, 'Nenhum componente raiz encontrado')
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
