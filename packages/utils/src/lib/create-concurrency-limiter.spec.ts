import { createConcurrencyLimiter } from './create-concurrency-limiter';

describe('createConcurrencyLimiter', () => {
  it('executes a single task immediately', async () => {
    const limit = createConcurrencyLimiter(2);
    const result = await limit(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('runs tasks up to the concurrency limit in parallel', async () => {
    const limit = createConcurrencyLimiter(2);
    const running: number[] = [];
    const maxConcurrent = { value: 0 };

    const task = (id: number) =>
      limit(async () => {
        running.push(id);
        maxConcurrent.value = Math.max(maxConcurrent.value, running.length);
        await new Promise<void>((r) => setTimeout(r, 10));
        running.splice(running.indexOf(id), 1);
        return id;
      });

    await Promise.all([task(1), task(2), task(3), task(4)]);
    expect(maxConcurrent.value).toBe(2);
  });

  it('queues tasks that exceed concurrency and runs them after a slot frees', async () => {
    const limit = createConcurrencyLimiter(1);
    const order: number[] = [];

    const t1 = limit(async () => {
      order.push(1);
      await new Promise<void>((r) => setTimeout(r, 20));
      order.push(2);
    });
    const t2 = limit(async () => {
      order.push(3);
    });

    await Promise.all([t1, t2]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('propagates rejections from the wrapped function', async () => {
    const limit = createConcurrencyLimiter(2);
    await expect(limit(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  });

  it('resumes the queue after a rejection', async () => {
    const limit = createConcurrencyLimiter(1);
    const results: (number | string)[] = [];

    await limit(() => Promise.reject(new Error('fail'))).catch(() => results.push('err'));
    const val = await limit(() => Promise.resolve(99));
    results.push(val);

    expect(results).toEqual(['err', 99]);
  });
});
