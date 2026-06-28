import React, { useMemo } from 'react';
import { KeyRound, PlugZap, AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  Spinner,
  OGDialog,
  OGDialogTitle,
  OGDialogHeader,
  OGDialogContent,
} from '@librechat/client';
import type { MCPServerStatus } from 'librechat-data-provider';
import type { ConfigFieldDetail } from '~/common';
import ServerInitializationSection from './ServerInitializationSection';
import CustomUserVarsSection from './CustomUserVarsSection';
import { useLocalize, useMCPServerManager } from '~/hooks';

interface MCPConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  fieldsSchema: Record<string, ConfigFieldDetail>;
  initialValues: Record<string, string>;
  onSave: (updatedValues: Record<string, string>) => void;
  isSubmitting?: boolean;
  onRevoke?: () => void;
  serverName: string;
  serverStatus?: MCPServerStatus;
  conversationId?: string | null;
  storageContextKey?: string;
}

export default function MCPConfigDialog({
  isOpen,
  onOpenChange,
  fieldsSchema,
  onSave,
  isSubmitting = false,
  onRevoke,
  serverName,
  serverStatus,
  conversationId,
  storageContextKey,
}: MCPConfigDialogProps) {
  const localize = useLocalize();
  const { availableMCPServersMap } = useMCPServerManager({ conversationId, storageContextKey });

  const hasFields = Object.keys(fieldsSchema).length > 0;
  const serverConfig = availableMCPServersMap?.[serverName] as
    | { title?: string; description?: string }
    | undefined;
  const friendlyName = serverConfig?.title || serverName;
  const serverDescription = serverConfig?.description;
  const dialogTitle = hasFields ? friendlyName : `${serverName} MCP Server`;

  const fullTitle = useMemo(() => {
    if (!serverStatus) {
      return localize('com_ui_mcp_dialog_title', {
        serverName,
        status: '',
      });
    }

    const { connectionState, requiresOAuth } = serverStatus;
    let statusText = '';

    if (connectionState === 'connecting') {
      statusText = localize('com_ui_connecting');
    } else if (connectionState === 'error') {
      statusText = localize('com_ui_error');
    } else if (connectionState === 'connected') {
      statusText = localize('com_ui_active');
    } else if (connectionState === 'disconnected') {
      statusText = requiresOAuth ? localize('com_ui_oauth') : localize('com_ui_offline');
    }

    return localize('com_ui_mcp_dialog_title', {
      serverName,
      status: statusText,
    });
  }, [serverStatus, serverName, localize]);

  /**
   * Render status badge with unified color system:
   * - Blue: Connecting/In-progress
   * - Amber: Needs action (OAuth required)
   * - Gray: Disconnected (neutral/inactive)
   * - Green: Connected (success)
   * - Red: Error
   */
  const renderStatusBadge = () => {
    if (!serverStatus) {
      return null;
    }

    const { connectionState, requiresOAuth } = serverStatus;

    // Connecting: blue (in progress)
    if (connectionState === 'connecting') {
      return (
        <div className="flex items-center gap-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
          <Spinner className="size-3" />
          <span>{localize('com_ui_connecting')}</span>
        </div>
      );
    }

    // Disconnected: check if needs action
    if (connectionState === 'disconnected') {
      if (requiresOAuth) {
        // Needs OAuth: amber (requires action)
        return (
          <div className="flex items-center gap-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <KeyRound className="size-3" aria-hidden="true" />
            <span>{localize('com_nav_mcp_status_needs_auth')}</span>
          </div>
        );
      }
      // Simply disconnected: gray (neutral)
      return (
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          <PlugZap className="size-3" aria-hidden="true" />
          <span>{localize('com_nav_mcp_status_disconnected')}</span>
        </div>
      );
    }

    // Error: red
    if (connectionState === 'error') {
      return (
        <div className="flex items-center gap-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-950 dark:text-red-400">
          <AlertTriangle className="size-3" aria-hidden="true" />
          <span>{localize('com_ui_error')}</span>
        </div>
      );
    }

    // Connected: green
    if (connectionState === 'connected') {
      return (
        <div className="flex items-center gap-2 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600 dark:bg-green-950 dark:text-green-400">
          <div className="size-1.5 rounded-full bg-green-500" />
          <span>{localize('com_ui_active')}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <OGDialog open={isOpen} onOpenChange={onOpenChange}>
      <OGDialogContent
        className="flex max-h-screen w-11/12 max-w-lg flex-col space-y-2"
        title={fullTitle}
      >
        <OGDialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-secondary text-text-secondary">
                <PlugZap className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <OGDialogTitle className="text-lg">
                  {dialogTitle.charAt(0).toUpperCase() + dialogTitle.slice(1)}
                </OGDialogTitle>
                {serverDescription && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-text-secondary">
                    {serverDescription}
                  </p>
                )}
              </div>
            </div>
            {renderStatusBadge()}
          </div>
        </OGDialogHeader>

        {hasFields && (
          <div className="flex gap-2.5 rounded-xl border border-border-light bg-surface-secondary p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-text-secondary" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-text-secondary">
              Vos identifiants sont chiffrés et restent privés. Lancya ne voit jamais votre mot de
              passe principal, et l'accès est révocable à tout moment.
            </p>
          </div>
        )}

        {/* Custom User Variables Section */}
        {hasFields && (
          <CustomUserVarsSection
            serverName={serverName}
            fields={fieldsSchema}
            onSave={onSave}
            onRevoke={onRevoke || (() => {})}
            isSubmitting={isSubmitting}
            conversationId={conversationId}
            storageContextKey={storageContextKey}
          />
        )}

        {/* Initialization button: only for OAuth / no-credential servers. For plain
            credential servers, the "Connecter" button above already saves + initializes. */}
        {(!hasFields || serverStatus?.requiresOAuth) && (
          <ServerInitializationSection
            serverName={serverName}
            conversationId={conversationId}
            storageContextKey={storageContextKey}
            requiresOAuth={serverStatus?.requiresOAuth || false}
            hasCustomUserVars={fieldsSchema && Object.keys(fieldsSchema).length > 0}
          />
        )}
      </OGDialogContent>
    </OGDialog>
  );
}
