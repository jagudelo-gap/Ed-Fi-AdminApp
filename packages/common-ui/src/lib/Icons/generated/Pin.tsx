// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsPin, BsPinFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function Pin({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsPinFill : BsPin} {...rest} />;
}
Pin.displayName = 'Pin';
Pin.purpose = 'For pinning tenants';
