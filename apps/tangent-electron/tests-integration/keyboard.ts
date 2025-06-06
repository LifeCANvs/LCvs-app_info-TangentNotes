import type { Keyboard } from 'playwright'
import { isMac } from '../src/common/platform'

const modReplacement = isMac ? 'Meta' : 'Control'

export function shortcut(keyboard: Keyboard, combo: string) {
	return keyboard.press(combo.replace(/Mod/ig, modReplacement))
}
