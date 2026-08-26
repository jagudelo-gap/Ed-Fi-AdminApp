import { Attribute } from '..';

type BooleanProps = { isMasked?: boolean; isUrlExternal?: boolean } & (
  | { isUrl: true }
  | { isUrl?: false }
);
export type SecretFields = { key: string; label: string; booleans: BooleanProps }[];

type GenericSecret = Record<string, string>;
export type JsonSecret = { key: string; secret: string; url: string } & GenericSecret;

type Props = {
  value: JsonSecret;
  fields: SecretFields;
};
export const SecretValue = ({ value, fields }: Props) => {
  return (
    <>
      {fields.map(({ key, label, booleans }) => (
        <Attribute label={label} value={value[key]} isCopyable {...booleans} />
      ))}
    </>
  );
};

export const DEFAULT_SECRET_FIELDS: SecretFields = [
  { key: 'key', label: 'Key', booleans: {} },
  { key: 'secret', label: 'Secret', booleans: { isMasked: true } },
  { key: 'url', label: 'URL', booleans: { isUrl: true, isUrlExternal: true } },
];
