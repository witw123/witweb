/**
 * 条件类名合并工具
 *
 * 类似于 clsx 和 tailwind-merge 的功能，用于合并 React/Next.js 的 className
 * 支持条件类名、数组、对象等多种输入形式
 *
 * @example
 * cn('px-2', 'py-1', condition && 'bg-blue-500')
 * cn('px-2', className)
 * cn('btn', { 'btn-primary': isActive, 'btn-disabled': isDisabled })
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

/**
 * 合并类名
 *
 * 将多个类名输入合并为一个空格分隔的字符串
 * - 字符串和数字：直接添加
 * - 数组：递归展开
 * - 对象：值为 truthy 的键名被添加
 * - falsy 值（null, undefined, false, ''）：被忽略
 *
 * @param inputs - 类名输入（可变参数）
 * @returns 合并后的类名字符串
 */
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
