import type { TPlugin, TSkillSummary, Action } from 'librechat-data-provider';
import type { MCPServerInfo } from '~/common';

export type AgentItemKind = 'builtin' | 'tool' | 'mcp' | 'skill' | 'action';

/**
 * Literal IDs for built-in agent capabilities. Mirrors string values of
 * `AgentCapabilities` in librechat-data-provider — keep in sync if either
 * side adds, removes, or renames a member.
 */
export type BuiltinId = 'execute_code' | 'web_search' | 'file_search' | 'artifacts' | 'context';

export type AgentItemStatus = 'ready' | 'needs_setup' | 'disabled';

interface ItemBase {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  status?: AgentItemStatus;
}

export interface BuiltinItem extends ItemBase {
  kind: 'builtin';
  id: BuiltinId;
}

export interface ToolItem extends ItemBase {
  kind: 'tool';
  plugin: TPlugin;
}

export interface McpItem extends ItemBase {
  kind: 'mcp';
  server: MCPServerInfo;
  toolCount: number;
}

export interface SkillItem extends ItemBase {
  kind: 'skill';
  skill: TSkillSummary;
}

export interface ActionItem extends ItemBase {
  kind: 'action';
  action: Action;
  endpointCount: number;
}

export type AgentItem = BuiltinItem | ToolItem | McpItem | SkillItem | ActionItem;

export type ItemFilter = {
  search?: string;
  kind?: AgentItemKind | 'all';
  category?: string | 'all';
  view?: 'marketplace' | 'installed' | 'favorites' | 'mine';
};
