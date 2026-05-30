import { Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button, Input, InfoHoverCard, ESide } from '@librechat/client';
import type { TPlugin, TPluginAuthConfig, TPluginAction } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, '').trim();

type TPluginAuthFormProps = {
  plugin: TPlugin | undefined;
  onSubmit: (installActionData: TPluginAction) => void;
  isEntityTool?: boolean;
};

function PluginAuthForm({ plugin, onSubmit, isEntityTool }: TPluginAuthFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isValid, isSubmitting },
  } = useForm();

  const localize = useLocalize();
  const authConfig = plugin?.authConfig ?? [];
  const allFieldsOptional = authConfig.length > 0 && authConfig.every((c) => c.optional === true);

  const submit = handleSubmit((auth) =>
    onSubmit({
      pluginKey: plugin?.pluginKey ?? '',
      action: 'install',
      auth,
      isEntityTool,
    }),
  );

  return (
    <form className="flex w-full flex-col gap-4" method="POST" onSubmit={submit}>
      {authConfig.map((config: TPluginAuthConfig, i: number) => {
        const authField = config.authField.split('||')[0];
        const isOptional = config.optional === true;
        const error = errors[authField];
        const hint = config.description ? stripHtml(config.description) : '';
        return (
          <div key={`${authField}-${i}`} className="flex w-full flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <label htmlFor={authField} className="text-sm font-medium text-text-primary">
                {config.label}
              </label>
              {hint ? <InfoHoverCard side={ESide.Top} text={hint} /> : null}
            </div>
            <Input
              type="text"
              autoComplete="off"
              id={authField}
              aria-invalid={!!error}
              aria-describedby={error ? `${authField}-error` : undefined}
              aria-label={config.label}
              aria-required={!isOptional}
              /* autoFocus is generally disabled due to the fact that it can disorient users,
               * but in this case, the required field must be navigated to anyways, and the component's functionality
               * emulates that of a new modal opening, where users would expect focus to be shifted to the new content */
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={i === 0}
              {...register(
                authField,
                isOptional
                  ? {}
                  : {
                      required: `${config.label} is required.`,
                      minLength: {
                        value: 1,
                        message: `${config.label} must be at least 1 character long`,
                      },
                    },
              )}
              className={cn(
                error &&
                  'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/40',
              )}
            />
            {error ? (
              <span id={`${authField}-error`} role="alert" className="text-xs text-red-500">
                {String(error.message ?? '')}
              </span>
            ) : null}
          </div>
        );
      })}
      <Button
        type="submit"
        variant="submit"
        disabled={allFieldsOptional ? isSubmitting : !isDirty || !isValid || isSubmitting}
        className="h-10 w-full gap-2 rounded-xl"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {localize('com_ui_save')}
      </Button>
    </form>
  );
}

export default PluginAuthForm;
