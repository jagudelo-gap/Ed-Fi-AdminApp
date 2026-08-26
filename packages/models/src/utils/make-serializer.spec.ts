import 'reflect-metadata';
import { Expose } from 'class-transformer';
import { makeSerializer } from './make-serializer';

class UserDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  secret: string;
}

const serialize = makeSerializer(UserDto);

describe('makeSerializer', () => {
  it('serializes a plain object to the DTO class, excluding non-exposed fields', () => {
    const result = serialize({ id: 1, name: 'Alice', secret: 'hidden' });
    expect(result).toBeInstanceOf(UserDto);
    expect(result.id).toBe(1);
    expect(result.name).toBe('Alice');
    expect(result.secret).toBeUndefined();
  });

  it('serializes an array of plain objects', () => {
    const result = serialize([
      { id: 1, name: 'Alice', secret: 'hidden' },
      { id: 2, name: 'Bob', secret: 'also-hidden' },
    ]);
    expect(Array.isArray(result)).toBe(true);
    const resultArray = result as unknown as UserDto[];
    expect(resultArray).toHaveLength(2);
    expect(resultArray[0]).toBeInstanceOf(UserDto);
    expect(resultArray[1].name).toBe('Bob');
    expect(resultArray[1].secret).toBeUndefined();
  });
});
