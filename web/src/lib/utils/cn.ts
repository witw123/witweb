/**
 * 
 * @example
 * cn('px-2', 'py-1', condition && 'bg-blue-500')
 * cn('px-2', className)
 */

type ClassValue = string | number | bigint | boolean | ClassArray | ClassDictionary | null | undefined;
interface ClassDictionary {
  [id: string]: unknown;
}
type ClassArray = ClassValue[];

function toVal(mix: ClassValue): string {
  let str = '';
  
  if (typeof mix === 'string' || typeof mix === 'number' || typeof mix === 'bigint') {
    str += mix;
  } else if (typeof mix === 'object' && mix !== null) {
    if (Array.isArray(mix)) {
      for (let i = 0; i < mix.length; i++) {
        const val = toVal(mix[i]);
        if (val) {
          if (str) str += ' ';
          str += val;
        }
      }
    } else {
      for (const key in mix as ClassDictionary) {
        if ((mix as ClassDictionary)[key]) {
          if (str) str += ' ';
          str += key;
        }
      }
    }
  }
  
  return str;
}

export function cn(...inputs: ClassValue[]): string {
  let str = '';
  
  for (let i = 0; i < inputs.length; i++) {
    const val = toVal(inputs[i]);
    if (val) {
      if (str) str += ' ';
      str += val;
    }
  }
  
  return str;
}

export default cn;
