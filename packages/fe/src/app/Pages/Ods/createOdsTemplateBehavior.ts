export const FIXED_NON_SB_TEMPLATE_OPTIONS = [
  { value: 'Minimal', label: 'Minimal' },
  { value: 'Sample', label: 'Sample' },
] as const;

export const getTemplateFieldName = (startingBlocks: boolean) =>
  startingBlocks ? 'templateName' : 'databaseTemplate';
