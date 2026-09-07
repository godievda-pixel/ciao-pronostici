import { homeCalcioPolishRuntimeSource } from './home-calcio-polish.mjs';

const BROKEN_FONT = "font-family:'Unbounded','Manrope',sans-serif";
const SAFE_FONT = 'font-family:"Unbounded","Manrope",sans-serif';
const EXPECTED_REPLACEMENTS = 2;

export function homeCalcioPolishRuntimeSourceSafe() {
  const source = homeCalcioPolishRuntimeSource();
  const count = source.split(BROKEN_FONT).length - 1;
  if (count !== EXPECTED_REPLACEMENTS) {
    throw new Error(`home/calcio unsafe font literal count invalid: ${count}`);
  }
  return source.split(BROKEN_FONT).join(SAFE_FONT);
}
