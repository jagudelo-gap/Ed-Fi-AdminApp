import { wait } from './wait';

describe('wait', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with the number of milliseconds passed', async () => {
    const promise = wait(500);
    jest.advanceTimersByTime(500);
    const result = await promise;
    expect(result).toBe(500);
  });

  it('does not resolve before the timeout elapses', async () => {
    let resolved = false;
    wait(1000).then(() => {
      resolved = true;
    });
    jest.advanceTimersByTime(999);
    await Promise.resolve();
    expect(resolved).toBe(false);
  });
});
