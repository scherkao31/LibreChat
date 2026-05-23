# Agent Tools Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the agent panel's separate Capabilities + Extensions sections (and the four entry-point dialogs for tools/MCP/skills/actions) with a unified in-panel chip row + three-column Marketplace dialog, treating built-in capabilities as first-class catalog items alongside tools, MCP servers, skills, and actions.

**Architecture:** UI-only redesign on top of the existing form schema. A pure-TypeScript `AgentItem` view-layer derives selected/available items from existing form fields (`tools[]`, `skills[]`, `actions[]`, capability flags); mutations write back to those same fields. The agent panel shrinks to a single `ToolsSection` (chip row + Add button); a new `ToolsMarketplaceDialog` is a 3-column shell (sidebar / catalog / detail) that hosts inline configuration for built-ins and popout dialogs for heavy flows (plugin auth, MCP variables, action editor).

**Tech Stack:** React 18 + TypeScript, react-hook-form (existing form state), `@librechat/client` (`OGDialog`, `OGDialogContent`, `OGDialogTemplate`, `Spinner`, etc.), `react-virtuoso` (already used for `VirtualizedAgentGrid`), Tailwind CSS, lucide-react icons, Jest + React Testing Library for tests, `date-fns` available where needed.

**Spec:** `docs/superpowers/specs/2026-05-23-agent-tools-marketplace-design.md`

**Phases:** Five independently shippable phases. Each ends with a green test suite and a working app.
- **Phase 1** — Pure-TS `Tools/items/*` module (foundation, no UI change).
- **Phase 2** — Marketplace dialog (read-only path behind dev entry point).
- **Phase 3** — Detail pane + popouts for every kind.
- **Phase 4** — Replace in-panel Capabilities + Extensions with `ToolsSection`.
- **Phase 5** — Delete dead code; remove orphaned translation keys.

---

## Conventions used in this plan

- All paths are relative to `/home/berry13/librechat` unless otherwise noted.
- Tests run from `client/`: `cd client && npx jest <pattern> --no-coverage`.
- TypeScript checks: `cd client && npx tsc --noEmit -p .`.
- Each task ends with a single conventional commit (no `Co-Authored-By` per user CLAUDE.md).
- Frontend dev server is started by the user; assume it auto-reloads.
- Use `i18n` skill if asked to expand translation coverage to other locales — this plan only updates `en/translation.json`.

---

# PHASE 1 — Foundation: `Tools/items/` pure-TS module

**Goal:** A view-layer module that derives a unified `AgentItem[]` catalog from the existing form state + endpoint queries, and exposes mutation helpers. Zero UI changes; all logic covered by unit tests.

**Exit criteria:**
- `catalog.spec.ts`, `selectors.spec.ts`, `mutations.spec.ts`, `filtering.spec.ts`, `icons.spec.ts` all pass.
- `npx tsc --noEmit -p .` clean for the new files.
- No production code consumes these modules yet.

---

### Task 1.1: Create directory and `types.ts`

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/items/types.ts`
- Create: `client/src/components/SidePanel/Agents/Tools/items/__tests__/types.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/SidePanel/Agents/Tools/items/__tests__/types.spec.ts`:

```ts
import type { AgentItem, AgentItemKind } from '../types';

describe('AgentItem types', () => {
  test('discriminator narrows the union', () => {
    const builtin: AgentItem = {
      kind: 'builtin',
      id: 'execute_code',
      name: 'Code Interpreter',
      description: 'Run Python',
      iconKey: 'execute_code',
    };

    expect(builtin.kind).toBe('builtin');
    if (builtin.kind === 'builtin') {
      expect(builtin.id).toBe('execute_code');
    }
  });

  test('AgentItemKind enumerates all five kinds', () => {
    const kinds: AgentItemKind[] = ['builtin', 'tool', 'mcp', 'skill', 'action'];
    expect(new Set(kinds).size).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest types.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '../types'".

- [ ] **Step 3: Write the types module**

Create `client/src/components/SidePanel/Agents/Tools/items/types.ts`:

```ts
import type { AgentCapabilities } from 'librechat-data-provider';
import type { TPlugin, TSkillSummary, Action } from 'librechat-data-provider';
import type { McpServerInfo } from '~/common';

export type AgentItemKind = 'builtin' | 'tool' | 'mcp' | 'skill' | 'action';

export type BuiltinId =
  | AgentCapabilities.execute_code
  | AgentCapabilities.web_search
  | AgentCapabilities.file_search
  | AgentCapabilities.artifacts
  | AgentCapabilities.context;

export type AgentItemStatus = 'ready' | 'needs_setup' | 'disabled';

export interface BuiltinItem {
  kind: 'builtin';
  id: BuiltinId;
  name: string;
  description: string;
  iconKey: string;
  status?: AgentItemStatus;
}

export interface ToolItem {
  kind: 'tool';
  id: string;
  name: string;
  description: string;
  iconKey: string;
  plugin: TPlugin;
  status?: AgentItemStatus;
}

export interface McpItem {
  kind: 'mcp';
  id: string;
  name: string;
  description: string;
  iconKey: string;
  server: McpServerInfo;
  toolCount: number;
  status?: AgentItemStatus;
}

export interface SkillItem {
  kind: 'skill';
  id: string;
  name: string;
  description: string;
  iconKey: string;
  skill: TSkillSummary;
  status?: AgentItemStatus;
}

export interface ActionItem {
  kind: 'action';
  id: string;
  name: string;
  description: string;
  iconKey: string;
  action: Action;
  endpointCount: number;
  status?: AgentItemStatus;
}

export type AgentItem = BuiltinItem | ToolItem | McpItem | SkillItem | ActionItem;

export type ItemFilter = {
  search?: string;
  kind?: AgentItemKind | 'all';
  category?: string | 'all';
  view?: 'marketplace' | 'installed' | 'favorites' | 'mine';
};
```

If `McpServerInfo`, `TSkillSummary`, or `Action` don't exist in the expected locations, find them and update the imports. To verify:

```bash
cd /home/berry13/librechat && grep -rn "export.*McpServerInfo\|export.*TSkillSummary\|export.*type Action\b" packages/data-provider/src/ client/src/common/ 2>/dev/null | head -10
```

If a type name differs, substitute the correct name and rerun the test.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest types.spec --no-coverage 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Run tsc to verify no type errors**

```bash
cd /home/berry13/librechat/client && npx tsc --noEmit -p . 2>&1 | grep "Tools/items" | head -10
```

Expected: no output (no errors in the new module).

- [ ] **Step 6: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/items/types.ts client/src/components/SidePanel/Agents/Tools/items/__tests__/types.spec.ts
git commit -m "feat: add AgentItem types for tools marketplace"
```

---

### Task 1.2: Add `icons.ts` mapping

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/items/icons.ts`
- Create: `client/src/components/SidePanel/Agents/Tools/items/__tests__/icons.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/SidePanel/Agents/Tools/items/__tests__/icons.spec.ts`:

```ts
import { getIconForItem } from '../icons';
import type { AgentItem } from '../types';

describe('getIconForItem', () => {
  test('returns icon + color for built-in execute_code', () => {
    const item: AgentItem = {
      kind: 'builtin',
      id: 'execute_code' as any,
      name: 'Code',
      description: '',
      iconKey: 'execute_code',
    };
    const result = getIconForItem(item);
    expect(result.Icon).toBeDefined();
    expect(result.colorClass).toMatch(/green/);
  });

  test('returns a distinct color class per kind', () => {
    const kinds: AgentItem['kind'][] = ['tool', 'mcp', 'skill', 'action'];
    const colors = kinds.map((k) => {
      const item = {
        kind: k,
        id: 'x',
        name: 'x',
        description: '',
        iconKey: 'fallback',
      } as unknown as AgentItem;
      return getIconForItem(item).colorClass;
    });
    expect(new Set(colors).size).toBe(kinds.length);
  });

  test('falls back to a generic icon for unknown built-in ids', () => {
    const item: AgentItem = {
      kind: 'builtin',
      id: 'unknown_capability' as any,
      name: 'X',
      description: '',
      iconKey: 'unknown_capability',
    };
    const result = getIconForItem(item);
    expect(result.Icon).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest icons.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '../icons'".

- [ ] **Step 3: Implement icons.ts**

Create `client/src/components/SidePanel/Agents/Tools/items/icons.ts`:

```ts
import {
  Code,
  Globe,
  Sparkles,
  FileText,
  FileSearch,
  Wrench,
  Server,
  Workflow,
  Zap,
  Layers,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AgentItem } from './types';

export interface ItemIcon {
  Icon: LucideIcon;
  colorClass: string;
}

const BUILTIN_ICONS: Record<string, ItemIcon> = {
  execute_code: { Icon: Code, colorClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' },
  web_search: { Icon: Globe, colorClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-300' },
  artifacts: { Icon: Sparkles, colorClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-300' },
  context: { Icon: FileText, colorClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-300' },
  file_search: { Icon: FileSearch, colorClass: 'bg-pink-500/15 text-pink-600 dark:text-pink-300' },
};

const KIND_FALLBACK_ICONS: Record<AgentItem['kind'], ItemIcon> = {
  builtin: { Icon: Layers, colorClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' },
  tool: { Icon: Wrench, colorClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-300' },
  mcp: { Icon: Server, colorClass: 'bg-violet-500/15 text-violet-600 dark:text-violet-300' },
  skill: { Icon: Zap, colorClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-300' },
  action: { Icon: Workflow, colorClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-300' },
};

export function getIconForItem(item: AgentItem): ItemIcon {
  if (item.kind === 'builtin') {
    return BUILTIN_ICONS[item.iconKey] ?? KIND_FALLBACK_ICONS.builtin;
  }
  return KIND_FALLBACK_ICONS[item.kind];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest icons.spec --no-coverage 2>&1 | tail -10
```

Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/items/icons.ts client/src/components/SidePanel/Agents/Tools/items/__tests__/icons.spec.ts
git commit -m "feat: map AgentItem kinds and built-ins to icons + colors"
```

---

### Task 1.3: Implement `catalog.ts`

The catalog builder takes raw inputs (admin config, queries' data, user permissions) and returns a flat `AgentItem[]` array filtered by what the user can actually see.

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/items/catalog.ts`
- Create: `client/src/components/SidePanel/Agents/Tools/items/__tests__/catalog.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/SidePanel/Agents/Tools/items/__tests__/catalog.spec.ts`:

```ts
import { AgentCapabilities } from 'librechat-data-provider';
import { buildCatalog } from '../catalog';

const emptyInputs = {
  agentsConfig: { capabilities: [] as string[] },
  regularTools: [],
  mcpServersMap: new Map(),
  skills: [],
  actions: [],
  permissions: { mcp: true, skills: true },
} as const;

describe('buildCatalog', () => {
  test('returns empty when nothing is enabled', () => {
    expect(buildCatalog(emptyInputs)).toEqual([]);
  });

  test('emits built-in items only for capabilities the admin enabled', () => {
    const items = buildCatalog({
      ...emptyInputs,
      agentsConfig: {
        capabilities: [
          AgentCapabilities.execute_code,
          AgentCapabilities.web_search,
        ],
      },
    });
    expect(items.filter((i) => i.kind === 'builtin').map((i) => i.id)).toEqual([
      AgentCapabilities.execute_code,
      AgentCapabilities.web_search,
    ]);
  });

  test('hides MCP items when the user lacks MCP permission', () => {
    const map = new Map();
    map.set('srv', { serverName: 'srv', isConfigured: true, tools: [] });
    const items = buildCatalog({
      ...emptyInputs,
      mcpServersMap: map,
      permissions: { mcp: false, skills: true },
    });
    expect(items.find((i) => i.kind === 'mcp')).toBeUndefined();
  });

  test('emits MCP items with tool counts', () => {
    const map = new Map();
    map.set('everything', {
      serverName: 'everything',
      isConfigured: true,
      tools: [{}, {}, {}],
    });
    const items = buildCatalog({
      ...emptyInputs,
      mcpServersMap: map,
    });
    const mcp = items.find((i) => i.kind === 'mcp');
    expect(mcp).toBeDefined();
    if (mcp?.kind === 'mcp') {
      expect(mcp.toolCount).toBe(3);
      expect(mcp.id).toBe('everything');
    }
  });

  test('emits skill items when permission granted', () => {
    const items = buildCatalog({
      ...emptyInputs,
      skills: [
        { _id: 's1', name: 'Reviewer', description: 'Reviews', category: 'code' },
      ] as any,
    });
    const skill = items.find((i) => i.kind === 'skill');
    expect(skill?.name).toBe('Reviewer');
  });

  test('emits tool items', () => {
    const items = buildCatalog({
      ...emptyInputs,
      regularTools: [
        { pluginKey: 'dalle', name: 'DALL-E', description: 'Images' },
      ] as any,
    });
    const tool = items.find((i) => i.kind === 'tool');
    expect(tool?.id).toBe('dalle');
  });

  test('emits action items with endpoint counts', () => {
    const items = buildCatalog({
      ...emptyInputs,
      actions: [
        {
          action_id: 'a1',
          metadata: { domain: 'linear.app', oauth_client_id: 'x' },
          settings: { paths: { '/issues': {}, '/teams': {} } },
        },
      ] as any,
    });
    const action = items.find((i) => i.kind === 'action');
    expect(action?.id).toBe('a1');
    if (action?.kind === 'action') {
      expect(action.endpointCount).toBe(2);
    }
  });

  test('returns items in stable order: builtin → mcp → tool → skill → action', () => {
    const map = new Map();
    map.set('srv', { serverName: 'srv', isConfigured: true, tools: [] });
    const items = buildCatalog({
      ...emptyInputs,
      agentsConfig: { capabilities: [AgentCapabilities.execute_code] },
      regularTools: [{ pluginKey: 't1', name: 'T1', description: '' }] as any,
      mcpServersMap: map,
      skills: [{ _id: 's1', name: 'S1', description: '' }] as any,
      actions: [
        { action_id: 'a1', metadata: { domain: 'd' }, settings: { paths: {} } },
      ] as any,
    });
    expect(items.map((i) => i.kind)).toEqual(['builtin', 'mcp', 'tool', 'skill', 'action']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest catalog.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '../catalog'".

- [ ] **Step 3: Implement catalog.ts**

Create `client/src/components/SidePanel/Agents/Tools/items/catalog.ts`:

```ts
import { AgentCapabilities } from 'librechat-data-provider';
import type { TPlugin, TSkillSummary, Action } from 'librechat-data-provider';
import type { AgentItem, BuiltinId } from './types';

export interface BuildCatalogInputs {
  agentsConfig: { capabilities: string[] };
  regularTools: TPlugin[];
  mcpServersMap: Map<string, { serverName: string; isConfigured: boolean; tools?: unknown[] }>;
  skills: TSkillSummary[];
  actions: Action[];
  permissions: { mcp: boolean; skills: boolean };
}

const BUILTIN_DEFINITIONS: Array<{
  id: BuiltinId;
  iconKey: string;
  nameKey: string;
  descriptionKey: string;
}> = [
  {
    id: AgentCapabilities.execute_code,
    iconKey: 'execute_code',
    nameKey: 'com_ui_run_code',
    descriptionKey: 'com_agents_run_code_info',
  },
  {
    id: AgentCapabilities.web_search,
    iconKey: 'web_search',
    nameKey: 'com_ui_web_search',
    descriptionKey: 'com_agents_search_info',
  },
  {
    id: AgentCapabilities.artifacts,
    iconKey: 'artifacts',
    nameKey: 'com_ui_artifacts',
    descriptionKey: 'com_ui_artifacts_info',
  },
  {
    id: AgentCapabilities.context,
    iconKey: 'context',
    nameKey: 'com_agents_file_context_label',
    descriptionKey: 'com_agents_file_context_info',
  },
  {
    id: AgentCapabilities.file_search,
    iconKey: 'file_search',
    nameKey: 'com_assistants_file_search',
    descriptionKey: 'com_assistants_file_search_info',
  },
];

export function buildCatalog(inputs: BuildCatalogInputs): AgentItem[] {
  const items: AgentItem[] = [];

  const enabled = new Set(inputs.agentsConfig.capabilities);
  for (const def of BUILTIN_DEFINITIONS) {
    if (!enabled.has(def.id)) continue;
    items.push({
      kind: 'builtin',
      id: def.id,
      iconKey: def.iconKey,
      name: def.nameKey,
      description: def.descriptionKey,
    });
  }

  if (inputs.permissions.mcp) {
    for (const [name, server] of inputs.mcpServersMap) {
      items.push({
        kind: 'mcp',
        id: name,
        name,
        description: '',
        iconKey: 'mcp',
        server: server as never,
        toolCount: server.tools?.length ?? 0,
      });
    }
  }

  for (const plugin of inputs.regularTools) {
    items.push({
      kind: 'tool',
      id: plugin.pluginKey,
      name: plugin.name ?? plugin.pluginKey,
      description: plugin.description ?? '',
      iconKey: 'tool',
      plugin,
    });
  }

  if (inputs.permissions.skills) {
    for (const skill of inputs.skills) {
      items.push({
        kind: 'skill',
        id: skill._id,
        name: skill.name,
        description: skill.description ?? '',
        iconKey: 'skill',
        skill,
      });
    }
  }

  for (const action of inputs.actions) {
    const paths = (action.settings as { paths?: Record<string, unknown> } | undefined)?.paths ?? {};
    items.push({
      kind: 'action',
      id: action.action_id,
      name: (action.metadata as { domain?: string } | undefined)?.domain ?? action.action_id,
      description: '',
      iconKey: 'action',
      action,
      endpointCount: Object.keys(paths).length,
    });
  }

  return items;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest catalog.spec --no-coverage 2>&1 | tail -15
```

Expected: PASS (8 passing).

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/items/catalog.ts client/src/components/SidePanel/Agents/Tools/items/__tests__/catalog.spec.ts
git commit -m "feat: build unified AgentItem catalog from agent panel inputs"
```

---

### Task 1.4: Implement `selectors.ts`

Derives the currently-selected `AgentItem[]` from the live form state. Used by the chip row (in-panel summary) and to compute the "selected" set inside the marketplace.

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/items/selectors.ts`
- Create: `client/src/components/SidePanel/Agents/Tools/items/__tests__/selectors.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/SidePanel/Agents/Tools/items/__tests__/selectors.spec.ts`:

```ts
import { AgentCapabilities } from 'librechat-data-provider';
import { deriveSelectedItems } from '../selectors';
import type { AgentItem } from '../types';

const sampleCatalog: AgentItem[] = [
  { kind: 'builtin', id: AgentCapabilities.execute_code, name: 'Code', description: '', iconKey: 'execute_code' },
  { kind: 'builtin', id: AgentCapabilities.web_search, name: 'Web', description: '', iconKey: 'web_search' },
  { kind: 'builtin', id: AgentCapabilities.artifacts, name: 'Art', description: '', iconKey: 'artifacts' },
  { kind: 'builtin', id: AgentCapabilities.context, name: 'Ctx', description: '', iconKey: 'context' },
  { kind: 'builtin', id: AgentCapabilities.file_search, name: 'FS', description: '', iconKey: 'file_search' },
  { kind: 'tool', id: 'dalle', name: 'DALL-E', description: '', iconKey: 'tool', plugin: { pluginKey: 'dalle' } as any },
  { kind: 'skill', id: 's1', name: 'Skill1', description: '', iconKey: 'skill', skill: { _id: 's1', name: 'Skill1' } as any },
];

describe('deriveSelectedItems', () => {
  test('returns nothing when nothing is selected', () => {
    expect(
      deriveSelectedItems(
        {
          execute_code: false,
          web_search: false,
          file_search: false,
          artifacts: '',
          tools: [],
          skills: [],
          context_files: [],
          knowledge_files: [],
          code_files: [],
        },
        sampleCatalog,
        [],
      ),
    ).toEqual([]);
  });

  test('selects built-in capabilities by their flags', () => {
    const result = deriveSelectedItems(
      {
        execute_code: true,
        web_search: false,
        file_search: false,
        artifacts: 'default',
        tools: [],
        skills: [],
        context_files: [],
        knowledge_files: [],
        code_files: [],
      },
      sampleCatalog,
      [],
    );
    const ids = result.map((i) => i.id);
    expect(ids).toContain(AgentCapabilities.execute_code);
    expect(ids).toContain(AgentCapabilities.artifacts);
    expect(ids).not.toContain(AgentCapabilities.web_search);
  });

  test('treats non-empty context_files as context selected even without an explicit flag', () => {
    const result = deriveSelectedItems(
      {
        execute_code: false,
        web_search: false,
        file_search: false,
        artifacts: '',
        tools: [],
        skills: [],
        context_files: [['f', {} as any]],
        knowledge_files: [],
        code_files: [],
      },
      sampleCatalog,
      [],
    );
    expect(result.find((i) => i.id === AgentCapabilities.context)).toBeDefined();
  });

  test('selects tools, skills, and MCP servers based on form arrays', () => {
    const catalog: AgentItem[] = [
      ...sampleCatalog,
      {
        kind: 'mcp',
        id: 'srv',
        name: 'srv',
        description: '',
        iconKey: 'mcp',
        server: { serverName: 'srv', isConfigured: true, tools: [] } as any,
        toolCount: 0,
      },
    ];
    const result = deriveSelectedItems(
      {
        execute_code: false,
        web_search: false,
        file_search: false,
        artifacts: '',
        tools: ['dalle', 'mcp_srv'],
        skills: ['s1'],
        context_files: [],
        knowledge_files: [],
        code_files: [],
      },
      catalog,
      [],
    );
    const kinds = result.map((i) => i.kind);
    expect(kinds).toContain('tool');
    expect(kinds).toContain('skill');
    expect(kinds).toContain('mcp');
  });

  test('selects all agent actions passed in', () => {
    const catalog: AgentItem[] = [
      ...sampleCatalog,
      {
        kind: 'action',
        id: 'a1',
        name: 'A1',
        description: '',
        iconKey: 'action',
        action: { action_id: 'a1', agent_id: 'agt' } as any,
        endpointCount: 1,
      },
    ];
    const result = deriveSelectedItems(
      {
        execute_code: false,
        web_search: false,
        file_search: false,
        artifacts: '',
        tools: [],
        skills: [],
        context_files: [],
        knowledge_files: [],
        code_files: [],
      },
      catalog,
      [{ action_id: 'a1' } as any],
    );
    expect(result.find((i) => i.kind === 'action')?.id).toBe('a1');
  });

  test('selected items preserve stable kind ordering', () => {
    const result = deriveSelectedItems(
      {
        execute_code: true,
        web_search: false,
        file_search: false,
        artifacts: '',
        tools: ['dalle'],
        skills: ['s1'],
        context_files: [],
        knowledge_files: [],
        code_files: [],
      },
      sampleCatalog,
      [],
    );
    const kindOrder = result.map((i) => i.kind);
    expect(kindOrder.indexOf('builtin')).toBeLessThan(kindOrder.indexOf('tool'));
    expect(kindOrder.indexOf('tool')).toBeLessThan(kindOrder.indexOf('skill'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest selectors.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '../selectors'".

- [ ] **Step 3: Implement selectors.ts**

Create `client/src/components/SidePanel/Agents/Tools/items/selectors.ts`:

```ts
import { AgentCapabilities } from 'librechat-data-provider';
import type { Action } from 'librechat-data-provider';
import type { AgentItem, AgentItemKind } from './types';

export interface FormSelection {
  execute_code: boolean;
  web_search: boolean;
  file_search: boolean;
  artifacts: string | undefined;
  tools: string[];
  skills: string[];
  context_files: Array<[string, unknown]>;
  knowledge_files: Array<[string, unknown]>;
  code_files: Array<[string, unknown]>;
}

const KIND_ORDER: AgentItemKind[] = ['builtin', 'mcp', 'tool', 'skill', 'action'];
const MCP_PREFIX = 'mcp_';

function isBuiltinSelected(item: AgentItem, form: FormSelection): boolean {
  if (item.kind !== 'builtin') return false;
  switch (item.id) {
    case AgentCapabilities.execute_code:
      return form.execute_code || form.code_files.length > 0;
    case AgentCapabilities.web_search:
      return form.web_search;
    case AgentCapabilities.file_search:
      return form.file_search || form.knowledge_files.length > 0;
    case AgentCapabilities.artifacts:
      return Boolean(form.artifacts);
    case AgentCapabilities.context:
      return form.context_files.length > 0;
    default:
      return false;
  }
}

function isToolSelected(item: AgentItem, form: FormSelection): boolean {
  if (item.kind !== 'tool') return false;
  return form.tools.includes(item.id);
}

function isMcpSelected(item: AgentItem, form: FormSelection): boolean {
  if (item.kind !== 'mcp') return false;
  return form.tools.some(
    (t) => t === item.id || t.startsWith(`${MCP_PREFIX}${item.id}_`) || t.endsWith(`_${MCP_PREFIX}${item.id}`),
  );
}

function isSkillSelected(item: AgentItem, form: FormSelection): boolean {
  if (item.kind !== 'skill') return false;
  return form.skills.includes(item.id);
}

function isActionSelected(item: AgentItem, agentActions: Action[]): boolean {
  if (item.kind !== 'action') return false;
  return agentActions.some((a) => a.action_id === item.id);
}

export function deriveSelectedItems(
  form: FormSelection,
  catalog: AgentItem[],
  agentActions: Action[],
): AgentItem[] {
  const selected = catalog.filter((item) => {
    if (item.kind === 'builtin') return isBuiltinSelected(item, form);
    if (item.kind === 'tool') return isToolSelected(item, form);
    if (item.kind === 'mcp') return isMcpSelected(item, form);
    if (item.kind === 'skill') return isSkillSelected(item, form);
    if (item.kind === 'action') return isActionSelected(item, agentActions);
    return false;
  });

  return selected.sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest selectors.spec --no-coverage 2>&1 | tail -15
```

Expected: PASS (6 passing).

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/items/selectors.ts client/src/components/SidePanel/Agents/Tools/items/__tests__/selectors.spec.ts
git commit -m "feat: derive selected AgentItems from existing form state"
```

---

### Task 1.5: Implement `mutations.ts`

Mutation helpers that produce form patches when items are toggled. The marketplace will call these, never write to form fields directly.

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/items/mutations.ts`
- Create: `client/src/components/SidePanel/Agents/Tools/items/__tests__/mutations.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/SidePanel/Agents/Tools/items/__tests__/mutations.spec.ts`:

```ts
import { AgentCapabilities, ArtifactModes } from 'librechat-data-provider';
import { computeToggleAction, applyTogglePatch } from '../mutations';
import type { AgentItem } from '../types';

const builtinCode: AgentItem = {
  kind: 'builtin',
  id: AgentCapabilities.execute_code,
  name: 'Code',
  description: '',
  iconKey: 'execute_code',
};

const builtinArtifacts: AgentItem = {
  kind: 'builtin',
  id: AgentCapabilities.artifacts,
  name: 'Art',
  description: '',
  iconKey: 'artifacts',
};

const tool: AgentItem = {
  kind: 'tool',
  id: 'dalle',
  name: 'DALL-E',
  description: '',
  iconKey: 'tool',
  plugin: { pluginKey: 'dalle' } as any,
};

const skill: AgentItem = {
  kind: 'skill',
  id: 's1',
  name: 'Skill',
  description: '',
  iconKey: 'skill',
  skill: { _id: 's1' } as any,
};

describe('computeToggleAction', () => {
  test('toggling execute_code on writes the boolean flag', () => {
    const patch = computeToggleAction(builtinCode, { selected: false });
    expect(patch).toEqual({
      type: 'builtin',
      field: AgentCapabilities.execute_code,
      value: true,
    });
  });

  test('toggling execute_code off writes false', () => {
    const patch = computeToggleAction(builtinCode, { selected: true });
    expect(patch).toEqual({
      type: 'builtin',
      field: AgentCapabilities.execute_code,
      value: false,
    });
  });

  test('toggling artifacts on writes the default mode', () => {
    const patch = computeToggleAction(builtinArtifacts, { selected: false });
    expect(patch).toEqual({
      type: 'builtin',
      field: AgentCapabilities.artifacts,
      value: ArtifactModes.DEFAULT,
    });
  });

  test('toggling artifacts off writes empty string', () => {
    const patch = computeToggleAction(builtinArtifacts, { selected: true });
    expect(patch).toEqual({
      type: 'builtin',
      field: AgentCapabilities.artifacts,
      value: '',
    });
  });

  test('toggling a tool emits a tools-array patch', () => {
    const patch = computeToggleAction(tool, { selected: false });
    expect(patch).toEqual({ type: 'tool-add', id: 'dalle' });
    const off = computeToggleAction(tool, { selected: true });
    expect(off).toEqual({ type: 'tool-remove', id: 'dalle' });
  });

  test('toggling a skill emits a skills-array patch', () => {
    const patch = computeToggleAction(skill, { selected: false });
    expect(patch).toEqual({ type: 'skill-add', id: 's1' });
  });
});

describe('applyTogglePatch', () => {
  const baseForm = {
    execute_code: false,
    web_search: false,
    file_search: false,
    artifacts: '',
    tools: [] as string[],
    skills: [] as string[],
  };

  test('builtin patch updates the matching field', () => {
    const next = applyTogglePatch(baseForm, {
      type: 'builtin',
      field: AgentCapabilities.execute_code,
      value: true,
    } as any);
    expect(next.execute_code).toBe(true);
  });

  test('tool-add appends without duplicates', () => {
    const next = applyTogglePatch(
      { ...baseForm, tools: ['x'] },
      { type: 'tool-add', id: 'y' },
    );
    expect(next.tools).toEqual(['x', 'y']);

    const noop = applyTogglePatch(next, { type: 'tool-add', id: 'y' });
    expect(noop.tools).toEqual(['x', 'y']);
  });

  test('tool-remove removes the id', () => {
    const next = applyTogglePatch(
      { ...baseForm, tools: ['x', 'y'] },
      { type: 'tool-remove', id: 'x' },
    );
    expect(next.tools).toEqual(['y']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest mutations.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '../mutations'".

- [ ] **Step 3: Implement mutations.ts**

Create `client/src/components/SidePanel/Agents/Tools/items/mutations.ts`:

```ts
import { AgentCapabilities, ArtifactModes } from 'librechat-data-provider';
import type { AgentItem } from './types';

export type TogglePatch =
  | { type: 'builtin'; field: AgentCapabilities; value: boolean | string }
  | { type: 'tool-add'; id: string }
  | { type: 'tool-remove'; id: string }
  | { type: 'skill-add'; id: string }
  | { type: 'skill-remove'; id: string }
  | { type: 'mcp-add'; serverName: string }
  | { type: 'mcp-remove'; serverName: string }
  | { type: 'action-add'; actionId: string }
  | { type: 'action-remove'; actionId: string };

function builtinTogglePatch(id: AgentCapabilities, selected: boolean): TogglePatch {
  if (id === AgentCapabilities.artifacts) {
    return {
      type: 'builtin',
      field: id,
      value: selected ? '' : ArtifactModes.DEFAULT,
    };
  }
  return { type: 'builtin', field: id, value: !selected };
}

export function computeToggleAction(
  item: AgentItem,
  state: { selected: boolean },
): TogglePatch {
  if (item.kind === 'builtin') {
    return builtinTogglePatch(item.id as AgentCapabilities, state.selected);
  }
  if (item.kind === 'tool') {
    return state.selected ? { type: 'tool-remove', id: item.id } : { type: 'tool-add', id: item.id };
  }
  if (item.kind === 'skill') {
    return state.selected ? { type: 'skill-remove', id: item.id } : { type: 'skill-add', id: item.id };
  }
  if (item.kind === 'mcp') {
    return state.selected
      ? { type: 'mcp-remove', serverName: item.id }
      : { type: 'mcp-add', serverName: item.id };
  }
  return state.selected
    ? { type: 'action-remove', actionId: item.id }
    : { type: 'action-add', actionId: item.id };
}

export interface MutableForm {
  execute_code: boolean;
  web_search: boolean;
  file_search: boolean;
  artifacts: string;
  tools: string[];
  skills: string[];
}

export function applyTogglePatch(form: MutableForm, patch: TogglePatch): MutableForm {
  switch (patch.type) {
    case 'builtin':
      return { ...form, [patch.field]: patch.value } as MutableForm;
    case 'tool-add': {
      if (form.tools.includes(patch.id)) return form;
      return { ...form, tools: [...form.tools, patch.id] };
    }
    case 'tool-remove':
      return { ...form, tools: form.tools.filter((t) => t !== patch.id) };
    case 'skill-add': {
      if (form.skills.includes(patch.id)) return form;
      return { ...form, skills: [...form.skills, patch.id] };
    }
    case 'skill-remove':
      return { ...form, skills: form.skills.filter((s) => s !== patch.id) };
    default:
      return form;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest mutations.spec --no-coverage 2>&1 | tail -15
```

Expected: PASS (9 passing).

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/items/mutations.ts client/src/components/SidePanel/Agents/Tools/items/__tests__/mutations.spec.ts
git commit -m "feat: compute and apply form patches for AgentItem toggles"
```

---

### Task 1.6: Implement `filtering.ts`

Search + sidebar filter predicates over an `AgentItem[]` list.

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/items/filtering.ts`
- Create: `client/src/components/SidePanel/Agents/Tools/items/__tests__/filtering.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/SidePanel/Agents/Tools/items/__tests__/filtering.spec.ts`:

```ts
import { applyFilter } from '../filtering';
import type { AgentItem } from '../types';

const items: AgentItem[] = [
  { kind: 'builtin', id: 'execute_code' as any, name: 'Code Interpreter', description: 'Run Python', iconKey: 'execute_code' },
  { kind: 'tool', id: 'dalle', name: 'DALL-E', description: 'Generate images', iconKey: 'tool', plugin: { pluginKey: 'dalle' } as any },
  { kind: 'skill', id: 's1', name: 'Code Reviewer', description: 'Review PRs', iconKey: 'skill', skill: { _id: 's1', name: 'Code Reviewer', category: 'code' } as any },
  { kind: 'skill', id: 's2', name: 'Marketing Email', description: 'Write emails', iconKey: 'skill', skill: { _id: 's2', name: 'Marketing Email', category: 'marketing' } as any },
];

describe('applyFilter', () => {
  test('no filter returns all items', () => {
    expect(applyFilter(items, {}).length).toBe(4);
  });

  test('search filters by name', () => {
    const result = applyFilter(items, { search: 'code' });
    expect(result.map((i) => i.id)).toEqual(['execute_code', 's1']);
  });

  test('search is case-insensitive across name and description', () => {
    const result = applyFilter(items, { search: 'IMAGES' });
    expect(result.map((i) => i.id)).toEqual(['dalle']);
  });

  test('kind filter restricts to one type', () => {
    const result = applyFilter(items, { kind: 'skill' });
    expect(result.map((i) => i.id)).toEqual(['s1', 's2']);
  });

  test('"all" kind is equivalent to no filter', () => {
    expect(applyFilter(items, { kind: 'all' }).length).toBe(4);
  });

  test('category filters skills by their category', () => {
    const result = applyFilter(items, { category: 'marketing' });
    expect(result.map((i) => i.id)).toEqual(['s2']);
  });

  test('combined filters apply intersection', () => {
    const result = applyFilter(items, { kind: 'skill', search: 'code' });
    expect(result.map((i) => i.id)).toEqual(['s1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest filtering.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '../filtering'".

- [ ] **Step 3: Implement filtering.ts**

Create `client/src/components/SidePanel/Agents/Tools/items/filtering.ts`:

```ts
import type { AgentItem, ItemFilter } from './types';

function getCategory(item: AgentItem): string | undefined {
  if (item.kind === 'skill') {
    return (item.skill as { category?: string }).category;
  }
  return undefined;
}

function matchesSearch(item: AgentItem, search: string): boolean {
  if (!search) return true;
  const term = search.toLowerCase();
  return (
    item.name.toLowerCase().includes(term) ||
    item.description.toLowerCase().includes(term)
  );
}

function matchesKind(item: AgentItem, kind: ItemFilter['kind']): boolean {
  if (!kind || kind === 'all') return true;
  return item.kind === kind;
}

function matchesCategory(item: AgentItem, category: ItemFilter['category']): boolean {
  if (!category || category === 'all') return true;
  return getCategory(item) === category;
}

export function applyFilter(items: AgentItem[], filter: ItemFilter): AgentItem[] {
  return items.filter(
    (item) =>
      matchesSearch(item, filter.search ?? '') &&
      matchesKind(item, filter.kind) &&
      matchesCategory(item, filter.category),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest filtering.spec --no-coverage 2>&1 | tail -15
```

Expected: PASS (7 passing).

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/items/filtering.ts client/src/components/SidePanel/Agents/Tools/items/__tests__/filtering.spec.ts
git commit -m "feat: search/kind/category filtering for AgentItem catalog"
```

---

### Task 1.7: Phase 1 wrap-up — verify the module compiles and all tests pass together

- [ ] **Step 1: Run every Phase 1 spec together**

```bash
cd /home/berry13/librechat/client && npx jest "Tools/items" --no-coverage 2>&1 | tail -15
```

Expected: all 5 test files pass (types, icons, catalog, selectors, mutations, filtering — 6 files actually).

- [ ] **Step 2: Type-check the project**

```bash
cd /home/berry13/librechat/client && npx tsc --noEmit -p . 2>&1 | grep "Tools/items" | head -10
```

Expected: no output (no errors in the new module).

If any pre-existing errors mention `Tools/items` paths, fix them. Pre-existing errors **outside** of Tools/items are not in scope and should be ignored.

- [ ] **Step 3: No commit needed** — verification only.

---

# PHASE 2 — Marketplace dialog (read-only, dev entry point)

**Goal:** Add the three-column marketplace dialog with sidebar, virtualized catalog, and cards. Cards toggle form state correctly. No detail pane yet — clicking a card writes the form patch and closes nothing. A temporary dev-only "Open new marketplace" button in `AgentFooter` exposes the dialog for testing.

**Exit criteria:**
- Dialog opens from the dev button.
- Sidebar filters work (Marketplace / Type / Category).
- Search filters cards.
- Clicking any card toggles the matching form field (verified by test).
- Existing Capabilities/Extensions sections still render and remain functional (we have not yet replaced them).

---

### Task 2.1: Add Phase 2 translation keys

**Files:**
- Modify: `client/src/locales/en/translation.json`

- [ ] **Step 1: Verify current Tools translation keys aren't already in use**

```bash
cd /home/berry13/librechat && grep -n "com_ui_tools_marketplace\|com_ui_tools_section" client/src/locales/en/translation.json | head -5
```

Expected: no output.

- [ ] **Step 2: Add new keys**

Open `client/src/locales/en/translation.json`. Find an alphabetically appropriate location (after the existing `com_ui_tools` block) and add:

```json
  "com_ui_tools_marketplace": "Marketplace",
  "com_ui_tools_marketplace_search": "Search the marketplace…",
  "com_ui_tools_section_title": "Tools",
  "com_ui_tools_section_count": "{{count}} enabled",
  "com_ui_tools_empty": "No tools yet",
  "com_ui_tools_empty_hint": "Add a tool to give your agent extra abilities.",
  "com_ui_tools_needs_setup": "Needs setup",
  "com_ui_tools_disabled_by_admin": "Disabled by admin",
  "com_ui_tools_remove": "Remove from agent",
  "com_ui_tools_create_new": "Create new…",
  "com_ui_tools_official": "Official",
  "com_ui_tools_recently_used": "Recently used",
  "com_ui_tools_view_marketplace": "Marketplace",
  "com_ui_tools_view_installed": "Installed",
  "com_ui_tools_view_favorites": "Favorites",
  "com_ui_tools_view_made_by_you": "Made by you",
  "com_ui_tools_kind_official": "Official",
  "com_ui_tools_kind_tools": "Tools",
  "com_ui_tools_kind_skills": "Skills",
  "com_ui_tools_kind_mcp": "MCP servers",
  "com_ui_tools_kind_actions": "Actions",
  "com_ui_tools_skills_enabled_kill_switch": "Allow skills for this agent",
  "com_ui_tools_skills_enabled_kill_switch_hint": "When off, the agent ignores any selected skills.",
  "com_ui_tools_close": "Close marketplace",
  "com_ui_tools_search_no_results": "Nothing matched your search",
```

Maintain valid JSON (commas, no trailing commas).

- [ ] **Step 3: Verify JSON parses**

```bash
cd /home/berry13/librechat && node -e "JSON.parse(require('fs').readFileSync('client/src/locales/en/translation.json'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
cd /home/berry13/librechat && git add client/src/locales/en/translation.json
git commit -m "chore(i18n): add tools marketplace translation keys"
```

---

### Task 2.2: Build `ToolCard`

A button rendering a single card. Click toggles selection by calling `onToggle(item)`.

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/ToolCard.tsx`
- Create: `client/src/components/SidePanel/Agents/Tools/__tests__/ToolCard.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/SidePanel/Agents/Tools/__tests__/ToolCard.spec.tsx`:

```tsx
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, screen } from '@testing-library/react';
import ToolCard from '../ToolCard';
import type { AgentItem } from '../items/types';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

const skill: AgentItem = {
  kind: 'skill',
  id: 's1',
  name: 'Reviewer',
  description: 'Review PRs',
  iconKey: 'skill',
  skill: { _id: 's1', name: 'Reviewer' } as any,
};

describe('ToolCard', () => {
  test('renders item name and description', () => {
    render(<ToolCard item={skill} selected={false} onToggle={jest.fn()} />);
    expect(screen.getByText('Reviewer')).toBeInTheDocument();
    expect(screen.getByText('Review PRs')).toBeInTheDocument();
  });

  test('clicking the card invokes onToggle with the item', () => {
    const onToggle = jest.fn();
    render(<ToolCard item={skill} selected={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /Reviewer/ }));
    expect(onToggle).toHaveBeenCalledWith(skill);
  });

  test('selected cards expose aria-pressed=true', () => {
    render(<ToolCard item={skill} selected onToggle={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Reviewer/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('renders an Official pill for built-ins', () => {
    const builtin: AgentItem = {
      kind: 'builtin',
      id: 'execute_code' as any,
      name: 'Code Interpreter',
      description: 'Run Python',
      iconKey: 'execute_code',
    };
    render(<ToolCard item={builtin} selected={false} onToggle={jest.fn()} />);
    expect(screen.getByText('com_ui_tools_official')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest ToolCard.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '../ToolCard'".

- [ ] **Step 3: Implement ToolCard.tsx**

Create `client/src/components/SidePanel/Agents/Tools/ToolCard.tsx`:

```tsx
import { Check } from 'lucide-react';
import type { AgentItem } from './items/types';
import { getIconForItem } from './items/icons';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface ToolCardProps {
  item: AgentItem;
  selected: boolean;
  onToggle: (item: AgentItem) => void;
}

export default function ToolCard({ item, selected, onToggle }: ToolCardProps) {
  const localize = useLocalize();
  const { Icon, colorClass } = getIconForItem(item);
  const isOfficial = item.kind === 'builtin';

  return (
    <button
      type="button"
      onClick={() => onToggle(item)}
      aria-pressed={selected}
      className={cn(
        'group relative flex h-32 cursor-pointer flex-col rounded-xl border p-3.5 text-left transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
        selected
          ? 'border-green-500/70 bg-green-500/[0.06]'
          : 'border-border-light hover:border-border-medium hover:bg-surface-tertiary',
        isOfficial && !selected && 'border-emerald-500/30 bg-emerald-500/[0.02]',
      )}
    >
      <div className="flex w-full items-start gap-2">
        <span
          className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', colorClass)}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">{item.name}</p>
        </div>
      </div>
      {item.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
          {item.description}
        </p>
      )}
      <div className="mt-auto flex w-full items-center gap-1.5 pt-2">
        {isOfficial && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {localize('com_ui_tools_official')}
          </span>
        )}
        {item.kind === 'mcp' && item.toolCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-tertiary px-2 py-0.5 text-[10px] text-text-tertiary">
            {item.toolCount} tools
          </span>
        )}
        <span
          className={cn(
            'ml-auto flex size-5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
            selected ? 'scale-100 bg-green-500 text-white opacity-100' : 'scale-75 opacity-0',
          )}
          aria-hidden="true"
        >
          <Check className="size-3" strokeWidth={3} />
        </span>
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest ToolCard.spec --no-coverage 2>&1 | tail -10
```

Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/ToolCard.tsx client/src/components/SidePanel/Agents/Tools/__tests__/ToolCard.spec.tsx
git commit -m "feat: ToolCard renders any AgentItem with selected state"
```

---

### Task 2.3: Build `MarketplaceSidebar`

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/MarketplaceSidebar.tsx`
- Create: `client/src/components/SidePanel/Agents/Tools/__tests__/MarketplaceSidebar.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/SidePanel/Agents/Tools/__tests__/MarketplaceSidebar.spec.tsx`:

```tsx
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, screen } from '@testing-library/react';
import MarketplaceSidebar from '../MarketplaceSidebar';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useCategories: () => ({ categories: [{ value: 'code', label: 'Code', icon: null }] }),
}));

describe('MarketplaceSidebar', () => {
  const defaultProps = {
    activeView: 'marketplace' as const,
    activeKind: 'all' as const,
    activeCategory: 'all' as const,
    onSelectView: jest.fn(),
    onSelectKind: jest.fn(),
    onSelectCategory: jest.fn(),
    counts: { tool: 2, skill: 3, mcp: 1, action: 0, builtin: 5 },
  };

  test('shows the sidebar title', () => {
    render(<MarketplaceSidebar {...defaultProps} />);
    expect(screen.getByText('com_ui_tools_marketplace')).toBeInTheDocument();
  });

  test('clicking a view filter calls onSelectView', () => {
    const onSelectView = jest.fn();
    render(<MarketplaceSidebar {...defaultProps} onSelectView={onSelectView} />);
    fireEvent.click(screen.getByText('com_ui_tools_view_installed'));
    expect(onSelectView).toHaveBeenCalledWith('installed');
  });

  test('clicking a kind filter calls onSelectKind', () => {
    const onSelectKind = jest.fn();
    render(<MarketplaceSidebar {...defaultProps} onSelectKind={onSelectKind} />);
    fireEvent.click(screen.getByText('com_ui_tools_kind_skills'));
    expect(onSelectKind).toHaveBeenCalledWith('skill');
  });

  test('clicking a category calls onSelectCategory', () => {
    const onSelectCategory = jest.fn();
    render(<MarketplaceSidebar {...defaultProps} onSelectCategory={onSelectCategory} />);
    fireEvent.click(screen.getByText('Code'));
    expect(onSelectCategory).toHaveBeenCalledWith('code');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest MarketplaceSidebar.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '../MarketplaceSidebar'".

- [ ] **Step 3: Implement MarketplaceSidebar.tsx**

Create `client/src/components/SidePanel/Agents/Tools/MarketplaceSidebar.tsx`:

```tsx
import { ListFilter, Star, User, Layers, Wrench, Server, Zap, Workflow, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AgentItemKind, ItemFilter } from './items/types';
import { useLocalize, useCategories } from '~/hooks';
import { cn } from '~/utils';

type View = NonNullable<ItemFilter['view']>;
type Kind = AgentItemKind | 'all';

interface MarketplaceSidebarProps {
  activeView: View;
  activeKind: Kind;
  activeCategory: string | 'all';
  onSelectView: (view: View) => void;
  onSelectKind: (kind: Kind) => void;
  onSelectCategory: (category: string | 'all') => void;
  counts: Record<AgentItemKind, number>;
}

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}

function SidebarItem({ icon, label, active, onClick, count }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
        active
          ? 'bg-surface-active text-text-primary'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] text-text-tertiary">{count}</span>
      )}
    </button>
  );
}

export default function MarketplaceSidebar({
  activeView,
  activeKind,
  activeCategory,
  onSelectView,
  onSelectKind,
  onSelectCategory,
  counts,
}: MarketplaceSidebarProps) {
  const localize = useLocalize();
  const { categories } = useCategories({ className: 'size-4', hasAccess: true });

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-border-light bg-surface-primary-alt p-3">
      <h2 className="px-2.5 pb-1.5 pt-1 text-base font-bold text-text-primary">
        {localize('com_ui_tools_marketplace')}
      </h2>
      <button
        type="button"
        className="mb-1 flex w-full items-center justify-center gap-2 rounded-lg border border-border-light bg-transparent px-2.5 py-1.5 text-center text-sm text-text-primary transition-colors hover:border-border-medium hover:bg-surface-hover"
      >
        <Plus className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{localize('com_ui_tools_create_new')}</span>
      </button>

      <SidebarItem icon={<Layers className="size-4" />} label={localize('com_ui_tools_view_marketplace')} active={activeView === 'marketplace'} onClick={() => onSelectView('marketplace')} />
      <SidebarItem icon={<Star className="size-4" />} label={localize('com_ui_tools_view_favorites')} active={activeView === 'favorites'} onClick={() => onSelectView('favorites')} />
      <SidebarItem icon={<User className="size-4" />} label={localize('com_ui_tools_view_made_by_you')} active={activeView === 'mine'} onClick={() => onSelectView('mine')} />

      <div className="my-2 h-px bg-border-light" />

      <SidebarItem icon={<ListFilter className="size-4" />} label={localize('com_ui_tools_kind_official')} active={activeKind === 'builtin'} onClick={() => onSelectKind('builtin')} count={counts.builtin} />
      <SidebarItem icon={<Wrench className="size-4" />} label={localize('com_ui_tools_kind_tools')} active={activeKind === 'tool'} onClick={() => onSelectKind('tool')} count={counts.tool} />
      <SidebarItem icon={<Zap className="size-4" />} label={localize('com_ui_tools_kind_skills')} active={activeKind === 'skill'} onClick={() => onSelectKind('skill')} count={counts.skill} />
      <SidebarItem icon={<Server className="size-4" />} label={localize('com_ui_tools_kind_mcp')} active={activeKind === 'mcp'} onClick={() => onSelectKind('mcp')} count={counts.mcp} />
      <SidebarItem icon={<Workflow className="size-4" />} label={localize('com_ui_tools_kind_actions')} active={activeKind === 'action'} onClick={() => onSelectKind('action')} count={counts.action} />

      <div className="my-2 h-px bg-border-light" />

      {(categories ?? []).map((cat: any) => {
        if (!cat?.value) return null;
        return (
          <SidebarItem
            key={cat.value}
            icon={cat.icon ?? <ListFilter className="size-4" />}
            label={cat.label}
            active={activeCategory === cat.value}
            onClick={() => onSelectCategory(cat.value)}
          />
        );
      })}
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest MarketplaceSidebar.spec --no-coverage 2>&1 | tail -10
```

Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/MarketplaceSidebar.tsx client/src/components/SidePanel/Agents/Tools/__tests__/MarketplaceSidebar.spec.tsx
git commit -m "feat: MarketplaceSidebar with views, kinds, and categories"
```

---

### Task 2.4: Build `MarketplaceCatalog` (non-virtualized first)

Renders a grid of `ToolCard` from a filtered `AgentItem[]`. Virtualization comes later.

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/MarketplaceCatalog.tsx`
- Create: `client/src/components/SidePanel/Agents/Tools/__tests__/MarketplaceCatalog.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/SidePanel/Agents/Tools/__tests__/MarketplaceCatalog.spec.tsx`:

```tsx
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, screen } from '@testing-library/react';
import MarketplaceCatalog from '../MarketplaceCatalog';
import type { AgentItem } from '../items/types';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

const items: AgentItem[] = [
  { kind: 'builtin', id: 'execute_code' as any, name: 'Code', description: 'Run', iconKey: 'execute_code' },
  { kind: 'tool', id: 'dalle', name: 'DALL-E', description: 'Images', iconKey: 'tool', plugin: { pluginKey: 'dalle' } as any },
];

describe('MarketplaceCatalog', () => {
  test('renders one card per item', () => {
    render(<MarketplaceCatalog items={items} selectedIds={new Set()} onToggle={jest.fn()} />);
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('DALL-E')).toBeInTheDocument();
  });

  test('clicking a card calls onToggle with the item', () => {
    const onToggle = jest.fn();
    render(<MarketplaceCatalog items={items} selectedIds={new Set()} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /DALL-E/ }));
    expect(onToggle).toHaveBeenCalledWith(items[1]);
  });

  test('selected ids mark cards aria-pressed=true', () => {
    render(<MarketplaceCatalog items={items} selectedIds={new Set(['dalle'])} onToggle={jest.fn()} />);
    expect(screen.getByRole('button', { name: /DALL-E/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Code/ })).toHaveAttribute('aria-pressed', 'false');
  });

  test('empty catalog shows "no results" message', () => {
    render(<MarketplaceCatalog items={[]} selectedIds={new Set()} onToggle={jest.fn()} />);
    expect(screen.getByText('com_ui_tools_search_no_results')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest MarketplaceCatalog.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Implement MarketplaceCatalog.tsx**

Create `client/src/components/SidePanel/Agents/Tools/MarketplaceCatalog.tsx`:

```tsx
import { Search } from 'lucide-react';
import type { AgentItem } from './items/types';
import ToolCard from './ToolCard';
import { useLocalize } from '~/hooks';

interface MarketplaceCatalogProps {
  items: AgentItem[];
  selectedIds: Set<string>;
  onToggle: (item: AgentItem) => void;
}

export default function MarketplaceCatalog({ items, selectedIds, onToggle }: MarketplaceCatalogProps) {
  const localize = useLocalize();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Search className="size-8 text-text-tertiary opacity-40" aria-hidden="true" />
        <p className="mt-3 text-sm text-text-secondary">
          {localize('com_ui_tools_search_no_results')}
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
      role="list"
      aria-label="Available items"
    >
      {items.map((item) => (
        <div role="listitem" key={`${item.kind}:${item.id}`}>
          <ToolCard item={item} selected={selectedIds.has(item.id)} onToggle={onToggle} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest MarketplaceCatalog.spec --no-coverage 2>&1 | tail -10
```

Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/MarketplaceCatalog.tsx client/src/components/SidePanel/Agents/Tools/__tests__/MarketplaceCatalog.spec.tsx
git commit -m "feat: MarketplaceCatalog grid of ToolCards"
```

---

### Task 2.5: Build `ToolsMarketplaceDialog` shell

Brings sidebar + catalog together inside `OGDialog`. Owns view + kind + category + search state. Resolves the catalog via React Query hooks, derives selected IDs from form state, and dispatches mutations on toggle.

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/ToolsMarketplaceDialog.tsx`
- Create: `client/src/components/SidePanel/Agents/Tools/__tests__/ToolsMarketplaceDialog.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/SidePanel/Agents/Tools/__tests__/ToolsMarketplaceDialog.spec.tsx`:

```tsx
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, screen } from '@testing-library/react';
import ToolsMarketplaceDialog from '../ToolsMarketplaceDialog';

const setValueMock = jest.fn();

jest.mock('react-hook-form', () => ({
  useFormContext: () => ({
    control: {},
    getValues: () => ({ tools: [], skills: [], execute_code: false, web_search: false, file_search: false, artifacts: '', context_files: [], knowledge_files: [], code_files: [] }),
    setValue: setValueMock,
  }),
  useWatch: ({ name }: any) => {
    const map: Record<string, unknown> = {
      tools: [], skills: [], execute_code: false, web_search: false, file_search: false, artifacts: '',
      context_files: [], knowledge_files: [], code_files: [],
    };
    return map[name];
  },
}));

jest.mock('~/Providers', () => ({
  useAgentPanelContext: () => ({
    agentsConfig: { capabilities: ['execute_code'] },
    regularTools: [{ pluginKey: 'dalle', name: 'DALL-E', description: 'Images' }],
    mcpServersMap: new Map(),
    actions: [],
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useHasAccess: () => true,
  useCategories: () => ({ categories: [] }),
}));

jest.mock('~/data-provider', () => ({
  useListSkillsQuery: () => ({ data: { skills: [] } }),
}));

jest.mock('@librechat/client', () => {
  const React = jest.requireActual('react');
  return {
    OGDialog: ({ children, open }: any) => (open ? React.createElement('div', null, children) : null),
    OGDialogContent: ({ children }: any) => React.createElement('div', null, children),
  };
});

describe('ToolsMarketplaceDialog', () => {
  beforeEach(() => setValueMock.mockClear());

  test('renders cards from catalog when open', () => {
    render(<ToolsMarketplaceDialog open onOpenChange={jest.fn()} agentId="a1" />);
    expect(screen.getByText('DALL-E')).toBeInTheDocument();
  });

  test('clicking a tool card calls setValue on tools array', () => {
    render(<ToolsMarketplaceDialog open onOpenChange={jest.fn()} agentId="a1" />);
    fireEvent.click(screen.getByRole('button', { name: /DALL-E/ }));
    expect(setValueMock).toHaveBeenCalledWith(
      'tools',
      expect.arrayContaining(['dalle']),
      expect.objectContaining({ shouldDirty: true }),
    );
  });

  test('typing in search input filters the catalog', () => {
    render(<ToolsMarketplaceDialog open onOpenChange={jest.fn()} agentId="a1" />);
    const input = screen.getByPlaceholderText('com_ui_tools_marketplace_search');
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('com_ui_tools_search_no_results')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest ToolsMarketplaceDialog.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Implement ToolsMarketplaceDialog.tsx**

Create `client/src/components/SidePanel/Agents/Tools/ToolsMarketplaceDialog.tsx`:

```tsx
import { useState, useMemo, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { OGDialog, OGDialogContent } from '@librechat/client';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import { useLocalize, useHasAccess } from '~/hooks';
import { useListSkillsQuery } from '~/data-provider';
import { useAgentPanelContext } from '~/Providers';
import { buildCatalog } from './items/catalog';
import { applyFilter } from './items/filtering';
import { deriveSelectedItems } from './items/selectors';
import { computeToggleAction } from './items/mutations';
import MarketplaceSidebar from './MarketplaceSidebar';
import MarketplaceCatalog from './MarketplaceCatalog';
import type { AgentItem, AgentItemKind, ItemFilter } from './items/types';

interface ToolsMarketplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

type View = NonNullable<ItemFilter['view']>;
type Kind = AgentItemKind | 'all';

export default function ToolsMarketplaceDialog({ open, onOpenChange, agentId }: ToolsMarketplaceDialogProps) {
  const localize = useLocalize();
  const { control, getValues, setValue } = useFormContext<AgentForm>();
  const { agentsConfig, regularTools, mcpServersMap, actions } = useAgentPanelContext();

  const hasMcpAccess = useHasAccess({
    permissionType: PermissionTypes.MCP_SERVERS,
    permission: Permissions.USE,
  });
  const hasSkillsAccess = useHasAccess({
    permissionType: PermissionTypes.SKILLS,
    permission: Permissions.USE,
  });

  const { data: skillsData } = useListSkillsQuery({ limit: 100 }, { enabled: hasSkillsAccess });

  const tools = useWatch({ control, name: 'tools' }) ?? [];
  const skills = useWatch({ control, name: 'skills' }) ?? [];
  const executeCode = useWatch({ control, name: 'execute_code' }) ?? false;
  const webSearch = useWatch({ control, name: 'web_search' }) ?? false;
  const fileSearch = useWatch({ control, name: 'file_search' }) ?? false;
  const artifacts = useWatch({ control, name: 'artifacts' }) ?? '';
  const contextFiles = (useWatch({ control, name: 'context_files' }) ?? []) as Array<[string, unknown]>;
  const knowledgeFiles = (useWatch({ control, name: 'knowledge_files' }) ?? []) as Array<[string, unknown]>;
  const codeFiles = (useWatch({ control, name: 'code_files' }) ?? []) as Array<[string, unknown]>;

  const [view, setView] = useState<View>('marketplace');
  const [kind, setKind] = useState<Kind>('all');
  const [category, setCategory] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');

  const agentActions = useMemo(
    () => (actions ?? []).filter((a: any) => a.agent_id === agentId),
    [actions, agentId],
  );

  const catalog = useMemo(
    () =>
      buildCatalog({
        agentsConfig: { capabilities: agentsConfig?.capabilities ?? [] },
        regularTools: regularTools ?? [],
        mcpServersMap: mcpServersMap ?? new Map(),
        skills: skillsData?.skills ?? [],
        actions: agentActions,
        permissions: { mcp: hasMcpAccess, skills: hasSkillsAccess },
      }),
    [agentsConfig, regularTools, mcpServersMap, skillsData, agentActions, hasMcpAccess, hasSkillsAccess],
  );

  const selectedItems = useMemo(
    () =>
      deriveSelectedItems(
        { execute_code: executeCode, web_search: webSearch, file_search: fileSearch, artifacts, tools, skills, context_files: contextFiles, knowledge_files: knowledgeFiles, code_files: codeFiles },
        catalog,
        agentActions,
      ),
    [executeCode, webSearch, fileSearch, artifacts, tools, skills, contextFiles, knowledgeFiles, codeFiles, catalog, agentActions],
  );
  const selectedIds = useMemo(() => new Set(selectedItems.map((i) => i.id)), [selectedItems]);

  const counts = useMemo(
    () => ({
      builtin: catalog.filter((i) => i.kind === 'builtin').length,
      tool: catalog.filter((i) => i.kind === 'tool').length,
      mcp: catalog.filter((i) => i.kind === 'mcp').length,
      skill: catalog.filter((i) => i.kind === 'skill').length,
      action: catalog.filter((i) => i.kind === 'action').length,
    }),
    [catalog],
  );

  const filtered = useMemo(
    () => applyFilter(catalog, { search, kind, category, view }),
    [catalog, search, kind, category, view],
  );

  const handleToggle = useCallback(
    (item: AgentItem) => {
      const patch = computeToggleAction(item, { selected: selectedIds.has(item.id) });

      switch (patch.type) {
        case 'builtin':
          setValue(patch.field as keyof AgentForm, patch.value as never, { shouldDirty: true });
          break;
        case 'tool-add': {
          const current = getValues('tools') ?? [];
          setValue('tools', Array.from(new Set([...current, patch.id])), { shouldDirty: true });
          break;
        }
        case 'tool-remove': {
          const current = getValues('tools') ?? [];
          setValue('tools', current.filter((t) => t !== patch.id), { shouldDirty: true });
          break;
        }
        case 'skill-add': {
          const current = getValues('skills') ?? [];
          setValue('skills', Array.from(new Set([...current, patch.id])), { shouldDirty: true });
          break;
        }
        case 'skill-remove': {
          const current = getValues('skills') ?? [];
          setValue('skills', current.filter((s) => s !== patch.id), { shouldDirty: true });
          break;
        }
        default:
          break;
      }
    },
    [getValues, setValue, selectedIds],
  );

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent
        className="w-11/12 max-w-[1024px] overflow-hidden rounded-2xl border-border-medium p-0 shadow-xl md:max-h-[85vh]"
        showCloseButton={false}
      >
        <div className="flex h-[80vh] max-h-[720px]">
          <MarketplaceSidebar
            activeView={view}
            activeKind={kind}
            activeCategory={category}
            onSelectView={setView}
            onSelectKind={setKind}
            onSelectCategory={setCategory}
            counts={counts}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 px-6 py-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={localize('com_ui_tools_marketplace_search')}
                  aria-label={localize('com_ui_tools_marketplace_search')}
                  className="h-10 w-full rounded-xl border border-border-light bg-transparent pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
                />
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border-light bg-transparent text-text-secondary transition-colors hover:border-border-medium hover:bg-surface-hover hover:text-text-primary"
                aria-label={localize('com_ui_tools_close')}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <MarketplaceCatalog items={filtered} selectedIds={selectedIds} onToggle={handleToggle} />
            </div>
          </div>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest ToolsMarketplaceDialog.spec --no-coverage 2>&1 | tail -10
```

Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/ToolsMarketplaceDialog.tsx client/src/components/SidePanel/Agents/Tools/__tests__/ToolsMarketplaceDialog.spec.tsx
git commit -m "feat: ToolsMarketplaceDialog 3-column shell with sidebar+catalog"
```

---

### Task 2.6: Add dev-only "Open new marketplace" button in `AgentFooter`

Lets us test the dialog against real agents without removing the existing Capabilities/Extensions UI.

**Files:**
- Modify: `client/src/components/SidePanel/Agents/AgentFooter.tsx`

- [ ] **Step 1: Read the current AgentFooter to find an insertion point**

```bash
cd /home/berry13/librechat && grep -n "showButtons\|AdminSettings\|return" client/src/components/SidePanel/Agents/AgentFooter.tsx | head -10
```

- [ ] **Step 2: Add state, button, and dialog mount**

Open `client/src/components/SidePanel/Agents/AgentFooter.tsx`. Add to the imports:

```tsx
import { useState } from 'react';
import ToolsMarketplaceDialog from './Tools/ToolsMarketplaceDialog';
```

Inside the component body, near the other state hooks:

```tsx
const [marketplaceOpen, setMarketplaceOpen] = useState(false);
```

Inside the JSX, just below the `{showButtons && ...}` grid, add:

```tsx
{showButtons && import.meta.env?.DEV && (
  <button
    type="button"
    onClick={() => setMarketplaceOpen(true)}
    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-light bg-transparent px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
  >
    Open new marketplace (dev)
  </button>
)}
<ToolsMarketplaceDialog
  open={marketplaceOpen}
  onOpenChange={setMarketplaceOpen}
  agentId={agent_id ?? ''}
/>
```

- [ ] **Step 3: Verify tests still pass**

```bash
cd /home/berry13/librechat/client && npx jest AgentFooter --no-coverage 2>&1 | tail -10
```

Expected: PASS (existing tests should still pass since the dev button is hidden in test environment).

- [ ] **Step 4: Manually verify in the dev server**

Start the dev server, open the agent panel, scroll to the footer, click "Open new marketplace (dev)", and confirm the dialog opens with sidebar + cards. Cards toggle without errors.

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/AgentFooter.tsx
git commit -m "feat: dev-only marketplace dialog entry in agent footer"
```

---

### Task 2.7: Phase 2 wrap-up

- [ ] **Step 1: Run every Tools/* spec**

```bash
cd /home/berry13/librechat/client && npx jest "components/SidePanel/Agents/Tools" --no-coverage 2>&1 | tail -10
```

Expected: all specs pass.

- [ ] **Step 2: Type-check**

```bash
cd /home/berry13/librechat/client && npx tsc --noEmit -p . 2>&1 | grep "Tools/" | head -10
```

Expected: no errors in the new Tools paths.

---

# PHASE 3 — Detail pane and popouts

**Goal:** Add the right-hand detail column that opens when the user clicks a selected card or any card requiring configuration. Built-ins render their config inline; tools/MCP/actions open popout dialogs for heavy forms.

**Exit criteria:**
- Every configuration path that exists today (set artifacts mode, paste a web search API key, attach files, configure MCP user vars, install plugin auth, edit an action) is reachable through the marketplace.
- All tests pass; manual smoke pass on each path documented in the spec acceptance criteria §12.

---

### Task 3.1: Extract `ActionEditor` from `ActionsPanel`

Before the popout can wrap it, the action editor needs to be a standalone component.

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/ActionEditor.tsx`
- Modify: `client/src/components/SidePanel/Agents/ActionsPanel.tsx`

- [ ] **Step 1: Read ActionsPanel to identify the inner body**

```bash
cd /home/berry13/librechat && wc -l client/src/components/SidePanel/Agents/ActionsPanel.tsx && head -50 client/src/components/SidePanel/Agents/ActionsPanel.tsx
```

- [ ] **Step 2: Create ActionEditor.tsx with the body extracted**

Create `client/src/components/SidePanel/Agents/Tools/ActionEditor.tsx`. Copy `ActionsPanel.tsx` into it, then remove the header (the `<header>` element containing back chevron + title + delete button) so the wrapper can provide its own. The component should accept props:

```tsx
interface ActionEditorProps {
  agentId: string;
  onClose: () => void;
  onDeleted?: () => void;
}
```

Inside, use `useAgentPanelContext()` exactly as `ActionsPanel.tsx` does today to read `action`, `setAction`. The `onClose` callback replaces all `setActivePanel(Panel.builder)` calls. The `onDeleted` callback (optional) fires after a successful delete mutation.

Keep `useForm`/`FormProvider`/`ActionsAuth`/`ActionsInput` intact.

- [ ] **Step 3: Make ActionsPanel delegate to ActionEditor**

Edit `client/src/components/SidePanel/Agents/ActionsPanel.tsx`. Replace its current body with:

```tsx
import { ChevronLeft } from 'lucide-react';
import { useAgentPanelContext } from '~/Providers/AgentPanelContext';
import ActionEditor from './Tools/ActionEditor';
import { useLocalize } from '~/hooks';
import { Panel } from '~/common';

export default function ActionsPanel() {
  const localize = useLocalize();
  const { setActivePanel, setAction, agent_id } = useAgentPanelContext();
  return (
    <div className="flex h-full flex-col px-2 pt-1">
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setActivePanel(Panel.builder);
            setAction(undefined);
          }}
          aria-label={localize('com_ui_back_to_builder')}
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-border-light text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <h2 className="text-center text-base font-semibold text-text-primary">Actions</h2>
        <span aria-hidden="true" className="h-10 w-10" />
      </header>
      <ActionEditor
        agentId={agent_id ?? ''}
        onClose={() => {
          setActivePanel(Panel.builder);
          setAction(undefined);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run existing tests, verify nothing broke**

```bash
cd /home/berry13/librechat/client && npx jest "ActionsPanel\|Actions" --no-coverage 2>&1 | tail -10
```

Expected: PASS or no matching tests (the current repo may not have a direct ActionsPanel spec).

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/ActionEditor.tsx client/src/components/SidePanel/Agents/ActionsPanel.tsx
git commit -m "refactor: extract ActionEditor body from ActionsPanel"
```

---

### Task 3.2: Build the three popout dialogs

Each popout wraps an existing form component in an `OGDialog`.

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/popouts/PluginAuthPopout.tsx`
- Create: `client/src/components/SidePanel/Agents/Tools/popouts/McpVarsPopout.tsx`
- Create: `client/src/components/SidePanel/Agents/Tools/popouts/ActionEditorPopout.tsx`

- [ ] **Step 1: PluginAuthPopout**

Create `PluginAuthPopout.tsx`:

```tsx
import { OGDialog, OGDialogContent } from '@librechat/client';
import { PluginAuthForm } from '~/components/Plugins/Store';
import type { TPlugin, TPluginAction } from 'librechat-data-provider';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plugin?: TPlugin;
  onSubmit: (action: TPluginAction) => void;
}

export default function PluginAuthPopout({ open, onOpenChange, plugin, onSubmit }: Props) {
  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="max-w-lg p-6">
        <PluginAuthForm plugin={plugin} onSubmit={onSubmit} isEntityTool />
      </OGDialogContent>
    </OGDialog>
  );
}
```

- [ ] **Step 2: McpVarsPopout**

Create `McpVarsPopout.tsx`:

```tsx
import { OGDialog, OGDialogContent } from '@librechat/client';
import CustomUserVarsSection from '~/components/MCP/CustomUserVarsSection';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  onSaved?: () => void;
}

export default function McpVarsPopout({ open, onOpenChange, serverName, onSaved }: Props) {
  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="max-w-lg p-6">
        <CustomUserVarsSection
          serverName={serverName}
          onSaved={() => {
            onSaved?.();
            onOpenChange(false);
          }}
        />
      </OGDialogContent>
    </OGDialog>
  );
}
```

If `CustomUserVarsSection` doesn't expose `onSaved`, inspect it (`grep -n "props\|interface" client/src/components/MCP/CustomUserVarsSection.tsx | head -10`) and adapt the prop names.

- [ ] **Step 3: ActionEditorPopout**

Create `ActionEditorPopout.tsx`:

```tsx
import { OGDialog, OGDialogContent } from '@librechat/client';
import ActionEditor from '../ActionEditor';
import { X } from 'lucide-react';
import { useLocalize } from '~/hooks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

export default function ActionEditorPopout({ open, onOpenChange, agentId }: Props) {
  const localize = useLocalize();
  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="w-11/12 max-w-[720px] overflow-hidden rounded-2xl border-border-medium p-0 shadow-xl md:max-h-[85vh]" showCloseButton={false}>
        <div className="flex max-h-[80vh] flex-col">
          <header className="flex items-center justify-between border-b border-border-light px-6 py-4">
            <h2 className="text-base font-semibold text-text-primary">{localize('com_assistants_add_actions')}</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex size-9 items-center justify-center rounded-xl border border-border-light text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
              aria-label={localize('com_ui_tools_close')}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>
          <div className="overflow-y-auto p-6">
            <ActionEditor agentId={agentId} onClose={() => onOpenChange(false)} />
          </div>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
```

- [ ] **Step 4: Type-check the three popouts**

```bash
cd /home/berry13/librechat/client && npx tsc --noEmit -p . 2>&1 | grep "Tools/popouts" | head -10
```

Expected: no errors. If types mismatch, adjust prop interfaces of the wrapped components.

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/popouts/
git commit -m "feat: popout wrappers for plugin auth, MCP vars, action editor"
```

---

### Task 3.3: Build `BuiltinDetail` (inline config for the five built-ins)

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/DetailPane/BuiltinDetail.tsx`
- Create: `client/src/components/SidePanel/Agents/Tools/DetailPane/__tests__/BuiltinDetail.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, screen } from '@testing-library/react';
import { AgentCapabilities } from 'librechat-data-provider';
import BuiltinDetail from '../BuiltinDetail';

const setValueMock = jest.fn();

jest.mock('react-hook-form', () => ({
  useFormContext: () => ({
    control: {},
    setValue: setValueMock,
  }),
  Controller: ({ render, name }: any) => render({ field: { value: '', onChange: jest.fn(), name } }),
  useWatch: () => '',
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('@librechat/client', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} {...props} />
  ),
}));

// Stub the heavy file picker components — they have their own tests.
jest.mock('../../../FileContext', () => () => <div data-testid="file-context" />);
jest.mock('../../../FileSearch', () => () => <div data-testid="file-search" />);
jest.mock('../../../Code/Files', () => () => <div data-testid="code-files" />);
jest.mock('../../../Artifacts', () => () => <div data-testid="artifacts-config" />);

describe('BuiltinDetail', () => {
  beforeEach(() => setValueMock.mockClear());

  test('execute_code shows a toggle that writes to the form', () => {
    render(<BuiltinDetail builtinId={AgentCapabilities.execute_code} agentId="a" onRemove={jest.fn()} />);
    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);
    expect(setValueMock).toHaveBeenCalledWith(
      'execute_code',
      expect.any(Boolean),
      expect.objectContaining({ shouldDirty: true }),
    );
  });

  test('context shows the FileContext picker', () => {
    render(<BuiltinDetail builtinId={AgentCapabilities.context} agentId="a" onRemove={jest.fn()} />);
    expect(screen.getByTestId('file-context')).toBeInTheDocument();
  });

  test('file_search shows the FileSearch picker', () => {
    render(<BuiltinDetail builtinId={AgentCapabilities.file_search} agentId="a" onRemove={jest.fn()} />);
    expect(screen.getByTestId('file-search')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest BuiltinDetail.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Implement BuiltinDetail.tsx**

Create `BuiltinDetail.tsx` (skeleton — adapt imports as needed):

```tsx
import { AgentCapabilities } from 'librechat-data-provider';
import { useFormContext, useWatch, Controller } from 'react-hook-form';
import { Switch } from '@librechat/client';
import type { AgentForm } from '~/common';
import { useLocalize } from '~/hooks';
import FileContext from '../../FileContext';
import FileSearch from '../../FileSearch';
import CodeFiles from '../../Code/Files';
import Artifacts from '../../Artifacts';

interface Props {
  builtinId: AgentCapabilities;
  agentId: string;
  onRemove: () => void;
}

export default function BuiltinDetail({ builtinId, agentId, onRemove }: Props) {
  const localize = useLocalize();
  const { control, setValue } = useFormContext<AgentForm>();

  if (builtinId === AgentCapabilities.execute_code) {
    const value = useWatch({ control, name: 'execute_code' });
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-xl border border-border-light p-4">
          <span className="text-sm font-medium text-text-primary">{localize('com_ui_run_code')}</span>
          <Switch
            checked={!!value}
            onCheckedChange={(next: boolean) => setValue('execute_code', next, { shouldDirty: true })}
            aria-label={localize('com_ui_run_code')}
          />
        </div>
        <CodeFiles agent_id={agentId} files={[]} />
      </div>
    );
  }

  if (builtinId === AgentCapabilities.context) {
    return <FileContext agent_id={agentId} files={[]} />;
  }

  if (builtinId === AgentCapabilities.file_search) {
    return <FileSearch agent_id={agentId} files={[]} />;
  }

  if (builtinId === AgentCapabilities.artifacts) {
    return <Artifacts />;
  }

  if (builtinId === AgentCapabilities.web_search) {
    const value = useWatch({ control, name: 'web_search' });
    return (
      <div className="flex items-center justify-between rounded-xl border border-border-light p-4">
        <span className="text-sm font-medium text-text-primary">{localize('com_ui_web_search')}</span>
        <Switch
          checked={!!value}
          onCheckedChange={(next: boolean) => setValue('web_search', next, { shouldDirty: true })}
          aria-label={localize('com_ui_web_search')}
        />
      </div>
    );
  }

  return null;
}
```

NOTE: This is a skeleton. The full implementation must (in later iterations within this same task) plumb through:
- Actual `files` props from parent — `BuiltinDetail` accepts `contextFiles`, `knowledgeFiles`, `codeFiles` props.
- Web Search inline API key form (lifted from `ApiKeyDialog`).

For this task, ship the skeleton that passes the three tests above. Plumbing context_files/etc. happens in the integration in Task 3.5 below.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest BuiltinDetail.spec --no-coverage 2>&1 | tail -10
```

Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/DetailPane/
git commit -m "feat: BuiltinDetail renders inline config for built-in capabilities"
```

---

### Task 3.4: Build `SkillDetail`, `ToolDetail`, `McpDetail`, `ActionDetail`

Light-weight detail bodies per kind. Each shows item metadata and a destructive remove action; tool/MCP/action open the relevant popout for heavy config.

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/DetailPane/SkillDetail.tsx`
- Create: `client/src/components/SidePanel/Agents/Tools/DetailPane/ToolDetail.tsx`
- Create: `client/src/components/SidePanel/Agents/Tools/DetailPane/McpDetail.tsx`
- Create: `client/src/components/SidePanel/Agents/Tools/DetailPane/ActionDetail.tsx`

- [ ] **Step 1: Write the failing test (single spec covering all four)**

Create `client/src/components/SidePanel/Agents/Tools/DetailPane/__tests__/Details.spec.tsx`:

```tsx
import '@testing-library/jest-dom/extend-expect';
import { render, screen, fireEvent } from '@testing-library/react';
import SkillDetail from '../SkillDetail';
import ToolDetail from '../ToolDetail';
import McpDetail from '../McpDetail';
import ActionDetail from '../ActionDetail';

jest.mock('~/hooks', () => ({ useLocalize: () => (k: string) => k }));
jest.mock('../../popouts/PluginAuthPopout', () => () => <div data-testid="plugin-auth-popout" />);
jest.mock('../../popouts/McpVarsPopout', () => () => <div data-testid="mcp-vars-popout" />);
jest.mock('../../popouts/ActionEditorPopout', () => () => <div data-testid="action-editor-popout" />);

const baseItem = { id: 'x', name: 'Test', description: 'Desc', iconKey: 'k' };

describe('Detail pane bodies', () => {
  test('SkillDetail renders name and remove button', () => {
    const onRemove = jest.fn();
    render(
      <SkillDetail
        item={{ ...baseItem, kind: 'skill', skill: { _id: 'x', name: 'Test' } as any }}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText('Test')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_tools_remove' }));
    expect(onRemove).toHaveBeenCalled();
  });

  test('ToolDetail offers Configure button when plugin needs auth', () => {
    render(
      <ToolDetail
        item={{ ...baseItem, kind: 'tool', plugin: { pluginKey: 'x', authConfig: [{}], authenticated: false } as any }}
        onRemove={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Configure/i }));
    expect(screen.getByTestId('plugin-auth-popout')).toBeInTheDocument();
  });

  test('McpDetail offers Configure variables when server is unconfigured', () => {
    render(
      <McpDetail
        item={{ ...baseItem, kind: 'mcp', server: { serverName: 'x', isConfigured: false } as any, toolCount: 0 }}
        onRemove={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Configure/i }));
    expect(screen.getByTestId('mcp-vars-popout')).toBeInTheDocument();
  });

  test('ActionDetail offers Edit action button', () => {
    render(
      <ActionDetail
        item={{ ...baseItem, kind: 'action', action: { action_id: 'x', agent_id: 'a' } as any, endpointCount: 3 }}
        agentId="a"
        onRemove={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    expect(screen.getByTestId('action-editor-popout')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest "Details.spec" --no-coverage 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Implement the four files**

Create `SkillDetail.tsx`:

```tsx
import type { SkillItem } from '../items/types';
import { useLocalize } from '~/hooks';

interface Props {
  item: SkillItem;
  onRemove: () => void;
}

export default function SkillDetail({ item, onRemove }: Props) {
  const localize = useLocalize();
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-text-primary">{item.name}</h3>
      {item.description && <p className="text-sm text-text-secondary">{item.description}</p>}
      <button
        type="button"
        onClick={onRemove}
        className="self-start rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-500/10"
      >
        {localize('com_ui_tools_remove')}
      </button>
    </div>
  );
}
```

Create `ToolDetail.tsx`:

```tsx
import { useState } from 'react';
import type { ToolItem } from '../items/types';
import PluginAuthPopout from '../popouts/PluginAuthPopout';
import { useLocalize } from '~/hooks';

interface Props {
  item: ToolItem;
  onRemove: () => void;
}

export default function ToolDetail({ item, onRemove }: Props) {
  const localize = useLocalize();
  const [authOpen, setAuthOpen] = useState(false);
  const needsAuth =
    (item.plugin.authConfig?.length ?? 0) > 0 && !item.plugin.authenticated;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-text-primary">{item.name}</h3>
      {item.description && <p className="text-sm text-text-secondary">{item.description}</p>}
      {needsAuth && (
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          className="self-start rounded-lg border border-border-light px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-secondary"
        >
          Configure key
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="self-start rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-500/10"
      >
        {localize('com_ui_tools_remove')}
      </button>
      <PluginAuthPopout
        open={authOpen}
        onOpenChange={setAuthOpen}
        plugin={item.plugin}
        onSubmit={() => setAuthOpen(false)}
      />
    </div>
  );
}
```

Create `McpDetail.tsx`:

```tsx
import { useState } from 'react';
import type { McpItem } from '../items/types';
import McpVarsPopout from '../popouts/McpVarsPopout';
import { useLocalize } from '~/hooks';

interface Props {
  item: McpItem;
  onRemove: () => void;
}

export default function McpDetail({ item, onRemove }: Props) {
  const localize = useLocalize();
  const [varsOpen, setVarsOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-text-primary">{item.name}</h3>
      <p className="text-sm text-text-secondary">{item.toolCount} tools</p>
      {!item.server.isConfigured && (
        <button
          type="button"
          onClick={() => setVarsOpen(true)}
          className="self-start rounded-lg border border-border-light px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-secondary"
        >
          Configure variables
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="self-start rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-500/10"
      >
        {localize('com_ui_tools_remove')}
      </button>
      <McpVarsPopout open={varsOpen} onOpenChange={setVarsOpen} serverName={item.id} />
    </div>
  );
}
```

Create `ActionDetail.tsx`:

```tsx
import { useState } from 'react';
import type { ActionItem } from '../items/types';
import ActionEditorPopout from '../popouts/ActionEditorPopout';
import { useLocalize } from '~/hooks';

interface Props {
  item: ActionItem;
  agentId: string;
  onRemove: () => void;
}

export default function ActionDetail({ item, agentId, onRemove }: Props) {
  const localize = useLocalize();
  const [editorOpen, setEditorOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-text-primary">{item.name}</h3>
      <p className="text-sm text-text-secondary">{item.endpointCount} endpoints</p>
      <button
        type="button"
        onClick={() => setEditorOpen(true)}
        className="self-start rounded-lg border border-border-light px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-secondary"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="self-start rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-500/10"
      >
        {localize('com_ui_tools_remove')}
      </button>
      <ActionEditorPopout open={editorOpen} onOpenChange={setEditorOpen} agentId={agentId} />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest Details.spec --no-coverage 2>&1 | tail -15
```

Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/DetailPane/
git commit -m "feat: Skill/Tool/Mcp/Action detail pane bodies + popouts"
```

---

### Task 3.5: Build `DetailPane` router and wire into `ToolsMarketplaceDialog`

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/DetailPane/DetailPane.tsx`
- Modify: `client/src/components/SidePanel/Agents/Tools/ToolsMarketplaceDialog.tsx`

- [ ] **Step 1: Create DetailPane.tsx**

```tsx
import { X } from 'lucide-react';
import { AgentCapabilities } from 'librechat-data-provider';
import type { AgentItem } from '../items/types';
import { getIconForItem } from '../items/icons';
import BuiltinDetail from './BuiltinDetail';
import SkillDetail from './SkillDetail';
import ToolDetail from './ToolDetail';
import McpDetail from './McpDetail';
import ActionDetail from './ActionDetail';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface Props {
  item: AgentItem;
  agentId: string;
  onClose: () => void;
  onRemove: () => void;
}

export default function DetailPane({ item, agentId, onClose, onRemove }: Props) {
  const localize = useLocalize();
  const { Icon, colorClass } = getIconForItem(item);

  let body: React.ReactNode;
  if (item.kind === 'builtin') {
    body = <BuiltinDetail builtinId={item.id as AgentCapabilities} agentId={agentId} onRemove={onRemove} />;
  } else if (item.kind === 'skill') {
    body = <SkillDetail item={item} onRemove={onRemove} />;
  } else if (item.kind === 'tool') {
    body = <ToolDetail item={item} onRemove={onRemove} />;
  } else if (item.kind === 'mcp') {
    body = <McpDetail item={item} onRemove={onRemove} />;
  } else {
    body = <ActionDetail item={item} agentId={agentId} onRemove={onRemove} />;
  }

  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l border-border-light bg-surface-primary p-6">
      <header className="mb-4 flex items-start gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', colorClass)} aria-hidden="true">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-text-primary">{item.name}</h2>
          <p className="text-xs uppercase tracking-wide text-text-tertiary">{item.kind}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 items-center justify-center rounded-xl border border-border-light text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
          aria-label={localize('com_ui_tools_close')}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">{body}</div>
    </aside>
  );
}
```

- [ ] **Step 2: Wire DetailPane into ToolsMarketplaceDialog**

Edit `ToolsMarketplaceDialog.tsx`:

Add state for `detailItem`:

```tsx
const [detailItem, setDetailItem] = useState<AgentItem | null>(null);
```

Modify `handleToggle` so that selecting an item also opens the detail pane:

```tsx
const handleToggle = useCallback(
  (item: AgentItem) => {
    const wasSelected = selectedIds.has(item.id);
    // …existing patch dispatch…
    if (!wasSelected) setDetailItem(item);
  },
  [/* deps */],
);
```

Add `handleRemove`:

```tsx
const handleRemove = useCallback(
  (item: AgentItem) => {
    // dispatch a remove patch (mirror toggle when selected=true)
    handleToggle(item);
    setDetailItem(null);
  },
  [handleToggle],
);
```

Render `DetailPane` after `<MarketplaceCatalog>`:

```tsx
{detailItem && (
  <DetailPane
    item={detailItem}
    agentId={agentId}
    onClose={() => setDetailItem(null)}
    onRemove={() => handleRemove(detailItem)}
  />
)}
```

- [ ] **Step 3: Verify ToolsMarketplaceDialog tests still pass**

```bash
cd /home/berry13/librechat/client && npx jest ToolsMarketplaceDialog --no-coverage 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/DetailPane/DetailPane.tsx client/src/components/SidePanel/Agents/Tools/ToolsMarketplaceDialog.tsx
git commit -m "feat: detail pane router + dialog integration"
```

---

### Task 3.6: Phase 3 manual smoke test

- [ ] **Step 1: Start the dev server and walk every flow**

| Flow | Steps | Expected |
|---|---|---|
| Toggle Code Interpreter | Open marketplace via dev button → click Code Interpreter card → detail pane opens → toggle the switch | `execute_code` becomes `true` in form (visible in dirty state, save enables) |
| Set Artifacts mode | Click Artifacts card → Artifacts inline body renders | Mode selector visible; selecting a mode writes to `artifacts` field |
| Attach context file | Click File Context card → FileContext component renders | Drag-drop works; file added to `context_files` |
| Configure MCP vars | Click an unconfigured MCP card → click "Configure variables" → popout opens | CustomUserVarsSection renders; on save the popout closes |
| Install plugin auth | Click a plugin needing auth → "Configure key" popout opens | PluginAuthForm renders; submitting installs the key |
| Edit action | Click action card → "Edit" popout opens | ActionEditor renders; can paste schema and save |

- [ ] **Step 2: Verify no regression in existing tests**

```bash
cd /home/berry13/librechat/client && npx jest --no-coverage 2>&1 | tail -10
```

Expected: green summary.

---

# PHASE 4 — Replace in-panel Capabilities + Extensions

**Goal:** Build `ToolsSection` + `ToolChip` and replace the two old sections in `AgentConfig.tsx`. Remove `Panel.actions` route. Move `skills_enabled` kill-switch into `AdvancedPanel.tsx`. Delete the dev-only entry from Phase 2.

**Exit criteria:**
- Agent panel renders the new chip-row Tools section in place of the old Capabilities + Extensions.
- All existing user flows reach completion through the marketplace.
- `Panel.actions` no longer routes the side panel.

---

### Task 4.1: Build `ToolChip`

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/ToolChip.tsx`
- Create: `client/src/components/SidePanel/Agents/Tools/__tests__/ToolChip.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, screen } from '@testing-library/react';
import ToolChip from '../ToolChip';
import type { AgentItem } from '../items/types';

jest.mock('~/hooks', () => ({ useLocalize: () => (k: string) => k }));

const skill: AgentItem = {
  kind: 'skill',
  id: 's1',
  name: 'Reviewer',
  description: '',
  iconKey: 'skill',
  skill: { _id: 's1', name: 'Reviewer' } as any,
};

describe('ToolChip', () => {
  test('renders the item name', () => {
    render(<ToolChip item={skill} onClick={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText('Reviewer')).toBeInTheDocument();
  });

  test('clicking the chip calls onClick with the item', () => {
    const onClick = jest.fn();
    render(<ToolChip item={skill} onClick={onClick} onRemove={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Reviewer/ }));
    expect(onClick).toHaveBeenCalledWith(skill);
  });

  test('renders an MCP tool count suffix when applicable', () => {
    const mcp: AgentItem = {
      kind: 'mcp', id: 'srv', name: 'srv', description: '', iconKey: 'mcp',
      server: { serverName: 'srv', isConfigured: true, tools: [] } as any,
      toolCount: 14,
    };
    render(<ToolChip item={mcp} onClick={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText(/14/)).toBeInTheDocument();
  });

  test('shows a state dot when status is needs_setup', () => {
    render(<ToolChip item={{ ...skill, status: 'needs_setup' }} onClick={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByLabelText('com_ui_tools_needs_setup')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest ToolChip.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Implement ToolChip.tsx**

```tsx
import { X } from 'lucide-react';
import type { AgentItem } from './items/types';
import { getIconForItem } from './items/icons';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface Props {
  item: AgentItem;
  onClick: (item: AgentItem) => void;
  onRemove: (item: AgentItem) => void;
}

function getSuffix(item: AgentItem): string | null {
  if (item.kind === 'mcp' && item.toolCount > 0) return `· ${item.toolCount}`;
  if (item.kind === 'action' && item.endpointCount > 0) return `· ${item.endpointCount}`;
  return null;
}

export default function ToolChip({ item, onClick, onRemove }: Props) {
  const localize = useLocalize();
  const { Icon, colorClass } = getIconForItem(item);
  const suffix = getSuffix(item);

  return (
    <span className="group relative inline-flex items-center">
      <button
        type="button"
        onClick={() => onClick(item)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-transparent py-1 pl-1 pr-2.5 text-xs text-text-primary transition-colors hover:border-border-medium hover:bg-surface-secondary"
      >
        <span className={cn('flex h-5 w-5 items-center justify-center rounded-full', colorClass)} aria-hidden="true">
          <Icon className="h-3 w-3" strokeWidth={2} />
        </span>
        <span className="max-w-[14ch] truncate">{item.name}</span>
        {suffix && <span className="text-text-tertiary">{suffix}</span>}
      </button>
      {item.status === 'needs_setup' && (
        <span
          aria-label={localize('com_ui_tools_needs_setup')}
          className="absolute right-1 top-1 size-1.5 rounded-full bg-red-500"
        />
      )}
      <button
        type="button"
        onClick={() => onRemove(item)}
        aria-label={localize('com_ui_tools_remove')}
        className="ml-1 hidden size-5 items-center justify-center rounded-full text-text-tertiary transition-colors group-hover:flex hover:bg-surface-secondary hover:text-text-primary"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest ToolChip.spec --no-coverage 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/ToolChip.tsx client/src/components/SidePanel/Agents/Tools/__tests__/ToolChip.spec.tsx
git commit -m "feat: ToolChip polymorphic chip for agent panel summary"
```

---

### Task 4.2: Build `ToolsSection`

**Files:**
- Create: `client/src/components/SidePanel/Agents/Tools/ToolsSection.tsx`
- Create: `client/src/components/SidePanel/Agents/Tools/__tests__/ToolsSection.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import '@testing-library/jest-dom/extend-expect';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolsSection from '../ToolsSection';

jest.mock('react-hook-form', () => ({
  useFormContext: () => ({ control: {}, getValues: jest.fn(), setValue: jest.fn() }),
  useWatch: () => [],
}));
jest.mock('~/hooks', () => ({ useLocalize: () => (k: string) => k, useHasAccess: () => true }));
jest.mock('~/Providers', () => ({
  useAgentPanelContext: () => ({
    agentsConfig: { capabilities: [] },
    regularTools: [],
    mcpServersMap: new Map(),
    actions: [],
  }),
}));
jest.mock('~/data-provider', () => ({ useListSkillsQuery: () => ({ data: { skills: [] } }) }));
jest.mock('../ToolsMarketplaceDialog', () => ({ open }: any) =>
  open ? <div data-testid="marketplace-open" /> : null,
);

describe('ToolsSection', () => {
  test('renders Tools header and Add button', () => {
    render(<ToolsSection agentId="a" />);
    expect(screen.getByText('com_ui_tools_section_title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add/ })).toBeInTheDocument();
  });

  test('clicking Add opens the marketplace dialog', () => {
    render(<ToolsSection agentId="a" />);
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));
    expect(screen.getByTestId('marketplace-open')).toBeInTheDocument();
  });

  test('renders empty state when no items are selected', () => {
    render(<ToolsSection agentId="a" />);
    expect(screen.getByText('com_ui_tools_empty')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/berry13/librechat/client && npx jest ToolsSection.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Implement ToolsSection.tsx**

```tsx
import { useState, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import Section from '../Section';
import ToolChip from './ToolChip';
import ToolsMarketplaceDialog from './ToolsMarketplaceDialog';
import { buildCatalog } from './items/catalog';
import { deriveSelectedItems } from './items/selectors';
import { computeToggleAction } from './items/mutations';
import type { AgentItem } from './items/types';
import { useAgentPanelContext } from '~/Providers';
import { useListSkillsQuery } from '~/data-provider';
import { useLocalize, useHasAccess } from '~/hooks';

interface Props {
  agentId: string;
}

export default function ToolsSection({ agentId }: Props) {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const { control, getValues, setValue } = useFormContext<AgentForm>();
  const { agentsConfig, regularTools, mcpServersMap, actions } = useAgentPanelContext();
  const hasMcpAccess = useHasAccess({ permissionType: PermissionTypes.MCP_SERVERS, permission: Permissions.USE });
  const hasSkillsAccess = useHasAccess({ permissionType: PermissionTypes.SKILLS, permission: Permissions.USE });
  const { data: skillsData } = useListSkillsQuery({ limit: 100 }, { enabled: hasSkillsAccess });

  const tools = (useWatch({ control, name: 'tools' }) ?? []) as string[];
  const skills = (useWatch({ control, name: 'skills' }) ?? []) as string[];
  const executeCode = useWatch({ control, name: 'execute_code' }) ?? false;
  const webSearch = useWatch({ control, name: 'web_search' }) ?? false;
  const fileSearch = useWatch({ control, name: 'file_search' }) ?? false;
  const artifacts = useWatch({ control, name: 'artifacts' }) ?? '';
  const contextFiles = (useWatch({ control, name: 'context_files' }) ?? []) as Array<[string, unknown]>;
  const knowledgeFiles = (useWatch({ control, name: 'knowledge_files' }) ?? []) as Array<[string, unknown]>;
  const codeFiles = (useWatch({ control, name: 'code_files' }) ?? []) as Array<[string, unknown]>;

  const agentActions = useMemo(
    () => (actions ?? []).filter((a: any) => a.agent_id === agentId),
    [actions, agentId],
  );

  const catalog = useMemo(
    () =>
      buildCatalog({
        agentsConfig: { capabilities: agentsConfig?.capabilities ?? [] },
        regularTools: regularTools ?? [],
        mcpServersMap: mcpServersMap ?? new Map(),
        skills: skillsData?.skills ?? [],
        actions: agentActions,
        permissions: { mcp: hasMcpAccess, skills: hasSkillsAccess },
      }),
    [agentsConfig, regularTools, mcpServersMap, skillsData, agentActions, hasMcpAccess, hasSkillsAccess],
  );

  const selected = useMemo(
    () =>
      deriveSelectedItems(
        { execute_code: executeCode, web_search: webSearch, file_search: fileSearch, artifacts, tools, skills, context_files: contextFiles, knowledge_files: knowledgeFiles, code_files: codeFiles },
        catalog,
        agentActions,
      ),
    [executeCode, webSearch, fileSearch, artifacts, tools, skills, contextFiles, knowledgeFiles, codeFiles, catalog, agentActions],
  );

  const isEmpty = selected.length === 0;

  const handleQuickRemove = useCallback(
    (item: AgentItem) => {
      const patch = computeToggleAction(item, { selected: true });
      switch (patch.type) {
        case 'builtin':
          setValue(patch.field as keyof AgentForm, patch.value as never, { shouldDirty: true });
          break;
        case 'tool-remove': {
          const current = getValues('tools') ?? [];
          setValue('tools', current.filter((t) => t !== patch.id), { shouldDirty: true });
          break;
        }
        case 'skill-remove': {
          const current = getValues('skills') ?? [];
          setValue('skills', current.filter((s) => s !== patch.id), { shouldDirty: true });
          break;
        }
        default:
          // mcp-remove and action-remove require coordination with their host
          // managers; fall back to opening the marketplace where the detail pane
          // owns the cleanup flow.
          setOpen(true);
      }
    },
    [getValues, setValue],
  );

  return (
    <Section
      title={localize('com_ui_tools_section_title')}
      badge={
        selected.length > 0 ? (
          <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface-tertiary px-1.5 text-xs font-medium text-text-secondary">
            {selected.length}
          </span>
        ) : null
      }
      rightSlot={
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {localize('com_ui_add')}
        </button>
      }
    >
      {isEmpty ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-border-light px-2 py-4 text-text-tertiary transition-colors hover:border-border-medium hover:bg-surface-secondary hover:text-text-secondary"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs">{localize('com_ui_tools_empty')}</span>
          <span className="text-[11px] text-text-tertiary">{localize('com_ui_tools_empty_hint')}</span>
        </button>
      ) : (
        <ul className="flex flex-wrap gap-1.5" role="list">
          {selected.map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <ToolChip
                item={item}
                onClick={() => setOpen(true)}
                onRemove={handleQuickRemove}
              />
            </li>
          ))}
        </ul>
      )}
      <ToolsMarketplaceDialog open={open} onOpenChange={setOpen} agentId={agentId} />
    </Section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/berry13/librechat/client && npx jest ToolsSection.spec --no-coverage 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Tools/ToolsSection.tsx client/src/components/SidePanel/Agents/Tools/__tests__/ToolsSection.spec.tsx
git commit -m "feat: ToolsSection in-panel summary with chip row + empty state"
```

---

### Task 4.3: Replace Capabilities + Extensions in `AgentConfig.tsx`

**Files:**
- Modify: `client/src/components/SidePanel/Agents/AgentConfig.tsx`

- [ ] **Step 1: Locate the lines to replace**

```bash
cd /home/berry13/librechat && grep -n "Capabilities\|Extensions" client/src/components/SidePanel/Agents/AgentConfig.tsx
```

Expected output includes import lines (~19–21) and JSX usages (~202–211).

- [ ] **Step 2: Edit AgentConfig.tsx**

- Remove the imports of `Capabilities` and `Extensions`.
- Add `import ToolsSection from './Tools/ToolsSection';`.
- Replace the JSX block `<Capabilities … /> <Extensions agentId={agent_id} />` with `<ToolsSection agentId={agent_id} />`.

- [ ] **Step 3: Verify tests and tsc**

```bash
cd /home/berry13/librechat/client && npx jest AgentConfig --no-coverage 2>&1 | tail -10
cd /home/berry13/librechat/client && npx tsc --noEmit -p . 2>&1 | grep "AgentConfig\|Tools/" | head -10
```

Expected: PASS (or no matching tests); no errors in AgentConfig / Tools.

- [ ] **Step 4: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/AgentConfig.tsx
git commit -m "feat: replace Capabilities + Extensions with ToolsSection"
```

---

### Task 4.4: Move `skills_enabled` kill-switch to `AdvancedPanel`

**Files:**
- Modify: `client/src/components/SidePanel/Agents/Advanced/AdvancedPanel.tsx`

- [ ] **Step 1: Inspect AdvancedPanel to find an insertion point**

```bash
cd /home/berry13/librechat && grep -n "return\|Controller\|Switch" client/src/components/SidePanel/Agents/Advanced/AdvancedPanel.tsx | head -20
```

- [ ] **Step 2: Add a Controller-backed Switch for `skills_enabled`**

In `AdvancedPanel.tsx`, near the other controllers, insert:

```tsx
{hasSkillsAccess && (
  <div className="rounded-xl border border-border-light p-3">
    <div className="flex items-center justify-between">
      <label htmlFor="skills_enabled_killswitch" className="text-sm font-medium text-text-primary">
        {localize('com_ui_tools_skills_enabled_kill_switch')}
      </label>
      <Controller
        name="skills_enabled"
        control={control}
        render={({ field }) => (
          <Switch
            id="skills_enabled_killswitch"
            checked={field.value === true}
            onCheckedChange={(v: boolean) => field.onChange(Boolean(v))}
            aria-label={localize('com_ui_tools_skills_enabled_kill_switch')}
          />
        )}
      />
    </div>
    <p className="mt-1 text-xs text-text-secondary">
      {localize('com_ui_tools_skills_enabled_kill_switch_hint')}
    </p>
  </div>
)}
```

Ensure imports include:

```tsx
import { Controller } from 'react-hook-form';
import { Switch } from '@librechat/client';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { useHasAccess } from '~/hooks';
```

And inside the component:

```tsx
const hasSkillsAccess = useHasAccess({ permissionType: PermissionTypes.SKILLS, permission: Permissions.USE });
```

- [ ] **Step 3: Verify the existing Extensions skills-enable strip can be removed**

The Extensions component currently has a `skills_enabled` toggle. Since Phase 4 deletes Extensions entirely, no separate removal step is needed — the toggle now lives only in Advanced.

- [ ] **Step 4: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/Advanced/AdvancedPanel.tsx
git commit -m "feat: move skills_enabled kill-switch into Advanced panel"
```

---

### Task 4.5: Remove `Panel.actions` route and dev-only entry point

**Files:**
- Modify: `client/src/components/SidePanel/Agents/AgentPanelSwitch.tsx`
- Modify: `client/src/components/SidePanel/Agents/AgentPanel.tsx`
- Modify: `client/src/components/SidePanel/Agents/AgentFooter.tsx` (remove dev button)

- [ ] **Step 1: Find all references to `Panel.actions`**

```bash
cd /home/berry13/librechat && grep -rn "Panel.actions" client/src/ packages/ 2>/dev/null | head -20
```

- [ ] **Step 2: Remove the route check in AgentPanelSwitch and AgentPanel**

In `AgentPanel.tsx`, remove the block:

```tsx
{canEditAgent && !agentQuery.isInitialLoading && activePanel === Panel.actions && (
  // ...
)}
```

(If such a block exists. If `Panel.actions` is only used by `AgentPanelSwitch`, edit there instead.) Verify by reading the file.

In `AgentPanelSwitch.tsx`, remove any `if (activePanel === Panel.actions) return <ActionsPanel />` and adjacent imports.

- [ ] **Step 3: Remove the dev-only marketplace entry from AgentFooter**

In `client/src/components/SidePanel/Agents/AgentFooter.tsx`, delete the `import.meta.env?.DEV` button added in Task 2.6. **Keep** the `ToolsMarketplaceDialog` mount — wait, no — the dialog mount was for dev only; since `ToolsSection` now mounts its own dialog, remove both: the button **and** the `<ToolsMarketplaceDialog>` mount in the footer.

- [ ] **Step 4: Verify tests and tsc**

```bash
cd /home/berry13/librechat/client && npx jest --no-coverage 2>&1 | tail -10
cd /home/berry13/librechat/client && npx tsc --noEmit -p . 2>&1 | grep "Panel.actions\|AgentFooter\|AgentPanel" | head -10
```

Expected: PASS; no errors.

- [ ] **Step 5: Commit**

```bash
cd /home/berry13/librechat && git add client/src/components/SidePanel/Agents/AgentPanelSwitch.tsx client/src/components/SidePanel/Agents/AgentPanel.tsx client/src/components/SidePanel/Agents/AgentFooter.tsx
git commit -m "refactor: remove Panel.actions route and dev marketplace entry"
```

---

### Task 4.6: Phase 4 manual smoke test

- [ ] **Step 1: Walk every flow from Phase 3 again but starting from the agent panel**

Open the agent builder side panel. Confirm:
- Tools section appears with chip row (or empty state).
- "＋ Add" opens the marketplace.
- Each card flow from Phase 3 still works end-to-end.
- Toggling Web Search prompts the API key configuration inline.
- Selecting an action opens the ActionEditorPopout.
- Saving the agent persists changes correctly (no stale form fields).

- [ ] **Step 2: Verify save → reload → re-open keeps state**

Make changes, save, refresh the browser, re-open the same agent → chip row should reflect the saved state.

---

# PHASE 5 — Cleanup

**Goal:** Delete superseded code, prune orphan translation keys, and verify no stale imports remain.

**Exit criteria:**
- The deleted files no longer exist.
- `grep` and `tsc` confirm no references.
- All tests pass.

---

### Task 5.1: Delete superseded component files

**Files:**
- Delete: `client/src/components/SidePanel/Agents/Capabilities.tsx`
- Delete: `client/src/components/SidePanel/Agents/Extensions.tsx`
- Delete: `client/src/components/Tools/ToolSelectDialog.tsx`
- Delete: `client/src/components/Tools/MCPToolSelectDialog.tsx`
- Delete: `client/src/components/Skills/dialogs/SkillSelectDialog.tsx`
- Delete: `client/src/components/SidePanel/Agents/ActionsPanel.tsx`

- [ ] **Step 1: Confirm none of these files are imported anywhere outside themselves**

```bash
cd /home/berry13/librechat && for f in Capabilities Extensions ToolSelectDialog MCPToolSelectDialog SkillSelectDialog ActionsPanel; do
  echo "=== $f ==="
  grep -rn "from.*$f\|import.*$f" client/src/ --include="*.ts" --include="*.tsx" | grep -v "Tools/" | grep -v "$f.tsx" | head -5
done
```

Expected: no remaining imports of the to-be-deleted files. If any survive (e.g. an import in `Skills/dialogs/index.ts`), update those files first.

- [ ] **Step 2: Update index files**

```bash
cd /home/berry13/librechat && grep -n "SkillSelectDialog\|ToolSelectDialog\|MCPToolSelectDialog" client/src/components/Skills/dialogs/index.ts client/src/components/Tools/index.ts 2>/dev/null
```

Remove any re-exports of the deleted files from `index.ts` modules.

- [ ] **Step 3: Delete the files**

```bash
cd /home/berry13/librechat && rm client/src/components/SidePanel/Agents/Capabilities.tsx \
  client/src/components/SidePanel/Agents/Extensions.tsx \
  client/src/components/Tools/ToolSelectDialog.tsx \
  client/src/components/Tools/MCPToolSelectDialog.tsx \
  client/src/components/Skills/dialogs/SkillSelectDialog.tsx \
  client/src/components/SidePanel/Agents/ActionsPanel.tsx
```

- [ ] **Step 4: Delete their test files if any exist**

```bash
cd /home/berry13/librechat && rm -f client/src/components/SidePanel/Agents/__tests__/Capabilities*.spec.tsx \
  client/src/components/SidePanel/Agents/__tests__/Extensions*.spec.tsx \
  client/src/components/Tools/__tests__/ToolSelectDialog*.spec.tsx \
  client/src/components/Tools/__tests__/MCPToolSelectDialog*.spec.tsx \
  client/src/components/Skills/dialogs/__tests__/SkillSelectDialog*.spec.tsx
```

- [ ] **Step 5: Verify tsc + jest**

```bash
cd /home/berry13/librechat/client && npx tsc --noEmit -p . 2>&1 | grep -v "^$" | head -20
cd /home/berry13/librechat/client && npx jest --no-coverage 2>&1 | tail -10
```

Expected: no new errors introduced; existing pre-existing errors stay the same.

- [ ] **Step 6: Commit**

```bash
cd /home/berry13/librechat && git add -A client/src/
git commit -m "chore: delete superseded Capabilities/Extensions/Selection dialogs"
```

---

### Task 5.2: Prune orphan translation keys

**Files:**
- Modify: `client/src/locales/en/translation.json`

- [ ] **Step 1: Identify orphans**

```bash
cd /home/berry13/librechat && for key in com_ui_extensions_filter_all com_ui_extensions_filter_tools com_ui_extensions_filter_actions com_ui_extensions_filter_mcp com_ui_extensions_filter_skills com_ui_extensions_add com_ui_extensions_empty com_ui_skills_enable_toggle com_ui_add_skills com_assistants_capabilities com_assistants_add_tools com_assistants_add_actions com_assistants_add_mcp_server_tools; do
  count=$(grep -rln "$key" client/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v translation.json | wc -l)
  if [ "$count" -eq 0 ]; then echo "ORPHAN: $key"; fi
done
```

- [ ] **Step 2: Remove only the orphans listed**

For each `ORPHAN:` line, remove the corresponding line in `client/src/locales/en/translation.json`. Keep keys still referenced anywhere — even if they appear stale.

- [ ] **Step 3: Verify JSON parses**

```bash
cd /home/berry13/librechat && node -e "JSON.parse(require('fs').readFileSync('client/src/locales/en/translation.json'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
cd /home/berry13/librechat && git add client/src/locales/en/translation.json
git commit -m "chore(i18n): prune orphan translation keys"
```

---

### Task 5.3: Final verification

- [ ] **Step 1: All tests**

```bash
cd /home/berry13/librechat/client && npx jest --no-coverage 2>&1 | tail -10
```

Expected: green summary.

- [ ] **Step 2: Type-check**

```bash
cd /home/berry13/librechat/client && npx tsc --noEmit -p . 2>&1 | head -20
```

Expected: no errors *introduced by this PR*. Pre-existing errors in unrelated files are out of scope.

- [ ] **Step 3: Manual full smoke**

Open the agent builder. Confirm every workflow from the spec acceptance criteria (§12) passes end to end:
1. Tools section renders the chip row.
2. ＋ Add opens the Marketplace.
3. Built-in cards are configurable inline.
4. Tool / MCP / Skill / Action cards open detail pane or popout for setup.
5. skills_enabled kill-switch in Advanced disables all skill chips.
6. Existing agents load correctly.
7. New tests cover the marketplace.

- [ ] **Step 4: Push branch and open PR**

```bash
cd /home/berry13/librechat && git push -u origin HEAD
```

Open the PR titled "feat(agents): unified Tools Marketplace replacing Capabilities + Extensions".

---

## Self-review checklist (for the engineer running this plan)

After the last task:

1. **Spec coverage** — Walk §1 through §12 of `docs/superpowers/specs/2026-05-23-agent-tools-marketplace-design.md`. For each section, confirm the matching tasks landed:
   - §3 (in-panel summary) → Tasks 4.1–4.3.
   - §4 (marketplace dialog) → Tasks 2.2–2.5.
   - §5 (per-kind config) → Tasks 3.2–3.5.
   - §6 (permissions/states) → covered in `buildCatalog` (Task 1.3) and detail/popout components.
   - §7 (file plan) → Phase 5 deletions; new file layout matches §2.
   - §12 (acceptance) → Task 5.3 smoke test.

2. **Outstanding gaps**:
   - The detail pane currently does not yet implement the **inline Web Search API key form** (the Task 3.3 skeleton omits it). Before declaring the work done, lift `ApiKeyDialog`'s form body into `BuiltinDetail`'s `web_search` branch.
   - The detail pane currently passes empty arrays for `files` to `FileContext` / `FileSearch` / `CodeFiles`. Wire through the real `context_files`, `knowledge_files`, `code_files` watched from the form so the file lists render correctly.
   - "Recently used" tracking is referenced in the spec (§4.2) but no task implements localStorage tracking. Add a small `Tools/items/recentlyUsed.ts` module + hook before Phase 4 sign-off.

3. **Resolve those gaps inline** rather than deferring — they are part of the spec.

---
