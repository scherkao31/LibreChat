import React, { useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Label, Input, Button, SecretInput } from '@librechat/client';
import type { Control, FieldErrors } from 'react-hook-form';
import { useMCPAuthValuesQuery } from '~/data-provider/Tools/queries';
import {
  CONFIG_HTML_INLINE_TAGS,
  CONFIG_HTML_CLASS_ATTR,
  createConfigHtmlSanitizer,
} from '~/utils/configHtml';
import { useLocalize, useMCPServerManager } from '~/hooks';

export interface CustomUserVarConfig {
  title: string;
  description?: string;
  /** Whether the field holds a secret and should be masked (defaults to masked when omitted). */
  sensitive?: boolean;
}

interface CustomUserVarsSectionProps {
  serverName: string;
  fields: Record<string, CustomUserVarConfig>;
  onSave: (authData: Record<string, string>) => void | Promise<void>;
  onRevoke: () => void;
  isSubmitting?: boolean;
  conversationId?: string | null;
  storageContextKey?: string;
}
interface AuthFieldProps {
  name: string;
  config: CustomUserVarConfig;
  hasValue: boolean;
  control: Control<Record<string, string>>;
  errors: FieldErrors<Record<string, string>>;
  autoFocus?: boolean;
}

function AuthField({ name, config, hasValue, control, errors, autoFocus }: AuthFieldProps) {
  const localize = useLocalize();
  const statusText = hasValue ? localize('com_ui_set') : localize('com_ui_unset');
  const sanitize = useMemo(
    () =>
      createConfigHtmlSanitizer({
        allowedTags: CONFIG_HTML_INLINE_TAGS,
        allowedAttr: CONFIG_HTML_CLASS_ATTR,
      }),
    [],
  );

  const sanitizedDescription = useMemo(() => {
    return sanitize(config.description);
  }, [config.description, sanitize]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={name} className="text-sm font-medium">
          {config.title} <span className="sr-only">({statusText})</span>
        </Label>
        <div aria-hidden="true">
          {hasValue ? (
            <div className="flex min-w-fit items-center gap-2 whitespace-nowrap rounded-full border border-border-light px-2 py-0.5 text-xs font-medium text-text-secondary">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span>{localize('com_ui_set')}</span>
            </div>
          ) : (
            <div className="flex min-w-fit items-center gap-2 whitespace-nowrap rounded-full border border-border-light px-2 py-0.5 text-xs font-medium text-text-secondary">
              <div className="h-1.5 w-1.5 rounded-full border border-border-medium" />
              <span>{localize('com_ui_unset')}</span>
            </div>
          )}
        </div>
      </div>
      <Controller
        name={name}
        control={control}
        defaultValue=""
        render={({ field }) => {
          const placeholder = hasValue
            ? localize('com_ui_mcp_update_var', { 0: config.title })
            : localize('com_ui_mcp_enter_var', { 0: config.title });
          const className =
            'w-full rounded-xl border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none';
          // Prevent autofill: browser DOM mutations bypass React's synthetic
          // onChange, silently emptying react-hook-form state on submit.
          const sharedProps = {
            id: name,
            'data-lpignore': 'true',
            'data-1p-ignore': 'true',
            /* autoFocus is generally disorienting, but here the required field is navigated to
             * anyway, and the section emulates a modal opening where users expect focus to shift. */
            autoFocus,
            ...field,
            placeholder,
            className,
          };
          if (config.sensitive === false) {
            return <Input {...sharedProps} type="text" autoComplete="off" />;
          }
          return <SecretInput {...sharedProps} autoComplete="new-password" controlsOnHover />;
        }}
      />
      {sanitizedDescription && (
        <p
          className="text-xs text-text-secondary [&_a]:text-blue-500 [&_a]:hover:underline"
          dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
        />
      )}
      {errors[name] && <p className="text-xs text-red-500">{errors[name]?.message}</p>}
    </div>
  );
}

export default function CustomUserVarsSection({
  fields,
  onSave,
  onRevoke,
  serverName,
  isSubmitting = false,
  conversationId,
  storageContextKey,
}: CustomUserVarsSectionProps) {
  const { initializeServer, isInitializing } = useMCPServerManager({
    conversationId,
    storageContextKey,
  });

  const { data: authValuesData } = useMCPAuthValuesQuery(serverName, {
    enabled: !!serverName,
  });

  const {
    reset,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, string>>({
    defaultValues: useMemo(() => {
      const initial: Record<string, string> = {};
      Object.keys(fields).forEach((key) => {
        initial[key] = '';
      });
      return initial;
    }, [fields]),
  });

  // Single "Connecter" action: save the credentials, then initialize the server in the
  // same click. We await the save so the server initializes with the freshly stored
  // credentials (otherwise it would try to connect with none). If the fields are left
  // empty (e.g. reopening an already-connected server), skip the save so we don't wipe
  // the stored credentials, and just re-initialize.
  const onFormSubmit = async (data: Record<string, string>) => {
    const hasInput = Object.values(data).some((value) => value.trim() !== '');
    if (hasInput) {
      try {
        await onSave(data);
      } catch {
        return;
      }
    }
    await initializeServer(serverName, false);
  };

  const handleRevokeClick = () => {
    onRevoke();
    reset();
  };

  if (!fields || Object.keys(fields).length === 0) {
    return null;
  }

  const busy = isSubmitting || isInitializing(serverName);
  const hasStoredValue = Object.values(authValuesData?.authValueFlags ?? {}).some(Boolean);

  return (
    <div className="flex-1 space-y-4">
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        {Object.entries(fields).map(([key, config], index) => {
          const hasValue = authValuesData?.authValueFlags?.[key] || false;

          return (
            <AuthField
              key={key}
              name={key}
              config={config}
              hasValue={hasValue}
              control={control}
              errors={errors}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- See AuthField autoFocus comment for more details
              autoFocus={index === 0}
            />
          );
        })}
      </form>

      <div className="space-y-2.5">
        <Button
          type="button"
          variant="submit"
          disabled={busy}
          onClick={handleSubmit(onFormSubmit)}
          className="w-full justify-center"
        >
          {busy ? 'Connexion…' : 'Connecter'}
        </Button>
        {hasStoredValue && (
          <button
            type="button"
            disabled={busy}
            onClick={handleRevokeClick}
            className="mx-auto block text-xs text-text-secondary transition-colors hover:text-text-primary hover:underline disabled:opacity-50"
          >
            Se déconnecter
          </button>
        )}
      </div>
    </div>
  );
}
