import { ButtonGroup as CBG, ButtonGroupProps, forwardRef } from '@chakra-ui/react';
import React from 'react';

export const ButtonGroup = forwardRef<ButtonGroupProps, 'div'>((props, ref) => {
  const { isAttached, spacing = 2 } = props;
  const styles = {
    flexDirection: { base: 'column', lg: 'row' },
    '& > *:not(style) ~ *:not(style)': {
      marginStart: { base: 0, lg: spacing },
      marginTop: { base: 3, lg: 0 },
    },
  };
  if (!isAttached) {
    return <CBG ref={ref} sx={styles} {...props} />;
  }
  return <CBG ref={ref} {...props} />;
});

const inactiveStyles = {
  color: 'gray.700',
  borderColor: 'gray.100',
  bg: 'gray.100',
  _hover: { bg: 'gray.300' },
  _active: { bg: 'gray.200' },
};

type ToggleChildProps = {
  value?: string;
  onClick?: () => void;
  sx?: unknown;
  colorScheme?: string;
};

/**
 * @example (
 * <ToggleButtonGroup onChange={handleChangeValue} value={value}>
 *  <Button value={value1}>label1</Button>
 *  <Button value={value2}>label2</Button>
 * </ToggleButtonGroup>
 * )
 * @note
 * must have multiple child elements
 */
export const ToggleButtonGroup: React.FC<{
  onChange: (value: string) => void;
  value: string;
  groupProps?: ButtonGroupProps;
  children?: React.ReactNode;
}> = ({ onChange, value, children, groupProps }) => {
  if (!children) throw new Error('ToggleButtonGroup requires children');

  const childNodes = React.Children.toArray(children);

  if (childNodes.length === 0) {
    throw new Error('ToggleButtonGroup requires at least one child element');
  }

  // iterate over array of child nodes to apply extended props
  return (
    <ButtonGroup {...groupProps}>
      {childNodes.map((childNode) => {
        if (!React.isValidElement<ToggleChildProps>(childNode)) {
          throw new TypeError(
            'ToggleButtonGroup children must be valid React elements, for example <Button value="example">Label</Button>'
          );
        }

        const childValue = childNode.props?.value;

        if (typeof childValue !== 'string') {
          throw new TypeError('ToggleButtonGroup child elements must include a string value prop');
        }

        const updatedProps: Partial<ToggleChildProps> = {
          onClick: () => {
            if (value === childValue) return;
            onChange(childValue);
          },
          ...(value === childValue ? { colorScheme: 'teal' } : { sx: inactiveStyles }),
        };

        return React.cloneElement(childNode, updatedProps);
      })}
    </ButtonGroup>
  );
};
