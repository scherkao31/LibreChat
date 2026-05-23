import { AgentCapabilities } from 'librechat-data-provider';
import type { TPlugin, TSkillSummary, Action } from 'librechat-data-provider';
import type { MCPServerInfo } from '~/common';
import type { AgentItem, BuiltinId } from './types';

export interface BuildCatalogInputs {
  agentsConfig: { capabilities: string[] };
  regularTools: TPlugin[];
  mcpServersMap: Map<string, MCPServerInfo>;
  skills: TSkillSummary[];
  actions: Action[];
  permissions: { mcp: boolean; skills: boolean };
}

interface BuiltinDef {
  id: BuiltinId;
  iconKey: string;
  nameKey: string;
  descriptionKey: string;
}

const BUILTIN_DEFINITIONS: BuiltinDef[] = [
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
    descriptionKey: 'com_ui_artifacts_subtext',
  },
  {
    id: AgentCapabilities.context,
    iconKey: 'context',
    nameKey: 'com_agents_file_context_label',
    descriptionKey: 'com_agents_file_context_description',
  },
  {
    id: AgentCapabilities.file_search,
    iconKey: 'file_search',
    nameKey: 'com_assistants_file_search',
    descriptionKey: 'com_assistants_file_search_info',
  },
];

function countEndpoints(settings: Action['settings']): number {
  if (!settings) {
    return 0;
  }
  const paths = (settings as { paths?: Record<string, unknown> }).paths;
  if (!paths) {
    return 0;
  }
  return Object.keys(paths).length;
}

export function buildCatalog(inputs: BuildCatalogInputs): AgentItem[] {
  const items: AgentItem[] = [];

  const enabled = new Set(inputs.agentsConfig.capabilities);
  for (const def of BUILTIN_DEFINITIONS) {
    if (!enabled.has(def.id)) {
      continue;
    }
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
        description: server.metadata?.description ?? '',
        iconKey: 'mcp',
        server,
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
    items.push({
      kind: 'action',
      id: action.action_id,
      name: action.metadata?.domain ?? action.action_id,
      description: '',
      iconKey: 'action',
      action,
      endpointCount: countEndpoints(action.settings),
    });
  }

  return items;
}
