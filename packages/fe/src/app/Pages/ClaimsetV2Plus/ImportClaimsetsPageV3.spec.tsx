import 'reflect-metadata';
import { act, render, screen } from '@testing-library/react';
import { validate } from 'class-validator';
import { ClaimsetItemV3, lowercaseFirstLetterOfKeys } from './ImportClaimsetsPageV3';
import { claimsetQueriesV3 } from '../../api';

// Wraps the real implementation so most tests behave exactly as before, but
// the async-race spec below can override individual calls to control
// resolution order.
jest.mock('class-validator', () => {
  const actual = jest.requireActual('class-validator');
  return { ...actual, validate: jest.fn(actual.validate) };
});
const mockValidate = validate as jest.Mock;

jest.mock('@edanalytics/common-ui', () => ({
  Icons: { InfoCircle: () => null, CheckCircle: () => null },
  PageTemplate: ({ children }: { children?: React.ReactNode }) => children,
}));

// Render real DOM nodes so text and the disabled state are assertable.
jest.mock('@chakra-ui/react', () => {
  const React = jest.requireActual('react');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const div = ({ children }: any) => React.createElement('div', null, children);
  return {
    Box: div,
    ButtonGroup: div,
    FormLabel: div,
    HStack: div,
    ListItem: div,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Popover: ({ children }: any) =>
      React.createElement(
        'div',
        null,
        typeof children === 'function' ? children({ isOpen: false }) : children
      ),
    PopoverArrow: div,
    PopoverBody: div,
    PopoverContent: div,
    PopoverTrigger: div,
    Tooltip: div,
    UnorderedList: div,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ children, isDisabled, onClick }: any) =>
      React.createElement('button', { disabled: !!isDisabled, onClick }, children),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Link: ({ children }: any) => React.createElement('span', null, children),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Text: ({ children }: any) => React.createElement('span', null, children),
    chakra: { input: div, pre: div, span: div },
  };
});

jest.mock('react-router', () => ({ Link: () => null }));

jest.mock('../../api', () => ({
  claimsetQueriesV3: { import: jest.fn() },
}));

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(() => ({
    teamId: 1,
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
  })),
}));

const mockImport = claimsetQueriesV3.import as jest.Mock;

describe('ImportClaimsetsPageV3 / ClaimsetItemV3', () => {
  beforeEach(() => {
    mockImport.mockReturnValue({
      isPending: false,
      isSuccess: false,
      data: undefined,
      mutateAsync: jest.fn().mockResolvedValue({ id: 5 }),
    });
  });
  afterEach(() => jest.clearAllMocks());

  it('uses the V3 import query', () => {
    render(<ClaimsetItemV3 maybeClaimset={{ name: 'ValidName', resourceClaims: [] }} />);
    expect(mockImport).toHaveBeenCalled();
  });

  it('surfaces a validation error for a name containing spaces', async () => {
    render(<ClaimsetItemV3 maybeClaimset={{ name: 'Has Spaces', resourceClaims: [] }} />);
    expect(await screen.findByText('Claimset validation failed')).toBeTruthy();
  });

  it('disables the Import button for a name containing spaces', async () => {
    render(<ClaimsetItemV3 maybeClaimset={{ name: 'Has Spaces', resourceClaims: [] }} />);
    await screen.findByText('Claimset validation failed');
    expect(
      (screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('does not surface an error for a whitespace-free name', async () => {
    render(<ClaimsetItemV3 maybeClaimset={{ name: 'NoSpaces', resourceClaims: [] }} />);
    // Let the async validate() chain settle before asserting the negative.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText('Claimset validation failed')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });
});

describe('ClaimsetItemV3 async validation race', () => {
  afterEach(() => jest.clearAllMocks());

  it('does not let a stale validate() resolution overwrite the state of a newer claimset', async () => {
    let resolveFirst: (errors: unknown[]) => void = () => undefined;
    let resolveSecond: (errors: unknown[]) => void = () => undefined;
    mockValidate
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const { rerender } = render(
      <ClaimsetItemV3 maybeClaimset={{ name: 'First', resourceClaims: [] }} />
    );

    // Same component instance (index-keyed list item) picks up a second file,
    // triggering the effect again while the first validate() is still pending.
    rerender(<ClaimsetItemV3 maybeClaimset={{ name: 'Second', resourceClaims: [] }} />);

    // The newer validation resolves first (valid — no errors).
    await act(async () => {
      resolveSecond([]);
    });
    expect(
      (screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled
    ).toBe(false);

    // The stale first validation resolves afterwards with an error. Without
    // the cancellation guard, this stale resolution would flip isInvalid back
    // on and re-show a validation error for what is now the "Second" entry —
    // exactly the bug this fix prevents.
    await act(async () => {
      resolveFirst([{ constraints: { matches: 'bad' } } as never]);
    });
    expect(
      (screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled
    ).toBe(false);
    expect(screen.queryByText('Claimset validation failed')).toBeNull();
  });
});

describe('lowercaseFirstLetterOfKeys', () => {
  it('does not let a __proto__ key reassign the resulting object prototype', () => {
    // JSON.parse (unlike an object literal) makes "__proto__" a normal own
    // enumerable key rather than the special prototype-setting syntax, which
    // is exactly how an attacker-supplied import file could reach this path.
    const malicious = JSON.parse('{"__proto__": {"polluted": true}, "Name": "x"}');

    const result = lowercaseFirstLetterOfKeys(malicious);

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect((result as { polluted?: unknown }).polluted).toBeUndefined();
    expect((Object.prototype as { polluted?: unknown }).polluted).toBeUndefined();
    expect(result.name).toBe('x');
  });

  it('does not let constructor/prototype keys pass through either', () => {
    const malicious = JSON.parse('{"constructor": {"bad": true}, "prototype": {"bad": true}, "Name": "x"}');

    const result = lowercaseFirstLetterOfKeys(malicious);

    expect(Object.keys(result)).toEqual(['name']);
    expect(result.name).toBe('x');
  });
});

describe('ImportClaimsetsPageV3 / stale state on invalid input', () => {
  // Regression guard for PR #330 review: list items are index-keyed, so this
  // component instance is reused when a new file is loaded. The array and
  // parse-error branches must clear `claimset`, or a previously valid name
  // renders beside the new error.
  it('clears a previously parsed claimset when the entry is replaced by an array', async () => {
    const { rerender } = render(
      <ClaimsetItemV3 maybeClaimset={{ name: 'ValidName', resourceClaims: [] }} />
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('ValidName')).toBeTruthy();

    rerender(<ClaimsetItemV3 maybeClaimset={[{ name: 'ValidName' }]} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText('ValidName')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
    expect(screen.getByText('Expected object, got array')).toBeTruthy();
  });
});
