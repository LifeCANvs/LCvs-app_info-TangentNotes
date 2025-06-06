import { requestCallbackOnIdle } from '@such-n-such/core'
import type { Workspace } from 'app/model'
import { HrefForm, HrefFormedLink, StructureType } from 'common/indexing/indexTypes'
import { isExternalLink } from 'common/links'
import { HandleResult, isNode } from 'app/model/NodeHandle'
import { dropTooltip, requestTooltip, TooltipConfig } from 'app/utils/tooltips'
import { SvelteConstructor } from 'app/utils/svelte'

export type LinkState = 'uninitialized' | 'empty' | 'resolved' | 'ambiguous' | 'untracked' | 'external' | 'error'

let tooltipComponent: SvelteConstructor = null
export function setTLinkTooltipComponent(component: SvelteConstructor) {
	tooltipComponent = component
}

class TangentLink extends HTMLElement {

	protected linkState: LinkState
	handleUnsub: () => void

	constructor() {
		super()
		this.addEventListener('click', this.onClick)
		this.addEventListener('auxclick', this.onClick)
		this.addEventListener('dblclick', this.onClick)
		this.addEventListener('mousedown', this.onClick)
		this.addEventListener('mouseup', this.onClick)
		this.addEventListener('contextmenu', this.onClick)
		this.addEventListener('mouseenter', this.makeTooltipRequest)
		this.addEventListener('mousemove', this.makeTooltipRequest)
		this.addEventListener('mouseleave', this.onMouseLeave)
	}

	connectedCallback() {
		if (this.isConnected) {
			requestCallbackOnIdle(() => this.updateState(), 1000)
		}
	}

	disconnectedCallback() {
		this.dropNodeHandle()
		dropTooltip(this, false)
	}

	static get observedAttributes() {
		return ['link-state', 'href', 'content_id', 'form', 'from']
	}

	attributeChangedCallback(name: string, oldValue: string, newValue: string) {
		switch (name) {
			case 'link-state':
				// This is a hack to ensure that the link state values *alwasy* remain, even if
				// a silly virtual dom thinks it's better than us and wants to override the
				// attributes
				if (newValue !== this.linkState) {
					this.setAttribute(name, this.linkState)
				}
				break
			case 'href':
			case 'content_id':
				requestCallbackOnIdle(() => this.updateState(), 1000)
				break
		}
	}

	updateState() {
		let link = this.getLinkInfo()
		if (link) {
			if (isExternalLink(link.href)) {
				this.setLinkState('external', null)
				this.dropNodeHandle()
			}
			else {
				const doc = document as any
				const workspace = doc.workspace as Workspace
				if (workspace) {
					this.dropNodeHandle()
					this.handleUnsub = workspace
						.getHandle(link)
						.subscribe(v => this.onNodeHandleChanged(v))
				}
			}
		}
		else {
			this.setLinkState('resolved', null)
		}
	}
	
	private onNodeHandleChanged(value: HandleResult) {
		let newState: LinkState = 'empty'

		if (typeof value === 'string') {
			newState = 'untracked'
		}
		else if (Array.isArray(value)) {
			if (value.length > 1) {
				newState = 'ambiguous'
			}
		}
		else if (value) {
			if (!isNode(value)) {
				newState = 'external'
			}
			else if (!value.meta?.virtual) {
				let contentId = this.getAttribute('content_id')
				if (contentId) {
					// TODO
				}
				newState = 'resolved'
			}
		}

		this.setLinkState(newState, value)
	}

	private dropNodeHandle() {
		if (this.handleUnsub) {
			this.handleUnsub()
			this.handleUnsub = null
		}
	}

	getLinkState() {
		return this.linkState
	}

	setLinkState(value: LinkState, context: HandleResult) {
		this.linkState = value
		this.setAttribute('link-state', value)
	}

	onClick(event) {
		event.tLink = this
	}

	getTooltip(): TooltipConfig {
		return {
			tooltip: tooltipComponent ?? 'Use `setTLinkTooltipComponent()` to define the component',
			maxWidth: '500px',
			interactive: true,
			args: {
				origin: this,
				link: this.getLinkInfo(),
				state: this.linkState
			}
		}
	}

	makeTooltipRequest(event: MouseEvent) {
		if (this.linkState === 'uninitialized') return
		requestTooltip(this, this.getTooltip(), event)
	}

	onMouseLeave() {
		dropTooltip(this)
	}

	getCleanedHref() {
		let href = this.getAttribute('href')
		if (this.linkState === 'external') return href
		return decodeURIComponent(href)
	}

	getLinkInfo(): HrefFormedLink {
		return {
			type: StructureType.Link,
			href: this.getCleanedHref(),
			form: this.getAttribute('form') as HrefForm,
			from: this.getAttribute('from'),
			content_id: this.getAttribute('content_id'),
			text: this.getAttribute('text')
		}
	}

	static isTangentLinkEvent(event: Event) {
		return this.getTangentLinkFromEvent(event) !== undefined
	}

	static isNavigationLinkOverride(event: Event) {
		return (event as any).tNavigationOverride === true
	}

	static getTangentLinkFromEvent(event: Event) {
		return (event as any).tLink as TangentLink
	}
}

customElements.define('t-link', TangentLink)
export default TangentLink
