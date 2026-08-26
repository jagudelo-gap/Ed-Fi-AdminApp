import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import TrimWhitespace from './TrimWhitespace';

class TestDto {
  @TrimWhitespace()
  name: string;
}

describe('TrimWhitespace', () => {
  it('trims leading and trailing whitespace from a string', () => {
    const result = plainToInstance(TestDto, { name: '  hello  ' });
    expect(result.name).toBe('hello');
  });

  it('leaves a string with no surrounding whitespace unchanged', () => {
    const result = plainToInstance(TestDto, { name: 'hello' });
    expect(result.name).toBe('hello');
  });

  it('leaves a non-string value (e.g. number) unchanged', () => {
    const result = plainToInstance(TestDto, { name: 42 as unknown as string });
    expect(result.name).toBe(42);
  });

  it('trims to empty string when value is only whitespace', () => {
    const result = plainToInstance(TestDto, { name: '   ' });
    expect(result.name).toBe('');
  });
});
