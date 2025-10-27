import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Global error surface so runtime issues don't look like a "white screen"
(() => {
	function showGlobalError(msg) {
		try {
			const id = 'global-error-overlay';
			let el = document.getElementById(id);
			if (!el) {
				el = document.createElement('div');
				el.id = id;
				el.style.position = 'fixed';
				el.style.top = '0';
				el.style.left = '0';
				el.style.right = '0';
				el.style.zIndex = '99999';
				el.style.background = '#1f2937';
				el.style.color = '#fff';
				el.style.padding = '12px 16px';
				el.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
				el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)';
				document.body.appendChild(el);
			}
			el.textContent = `Runtime error: ${msg}`;
		} catch {}
	}
	window.addEventListener('error', (e) => {
		if (!e) return;
		const msg = e.error?.stack || e.message || String(e);
		showGlobalError(msg);
	});
	window.addEventListener('unhandledrejection', (e) => {
		if (!e) return;
		const msg = e.reason?.stack || e.reason?.message || String(e.reason || e);
		showGlobalError(msg);
	});
})();

class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props)
		this.state = { hasError: false, error: null }
	}
	static getDerivedStateFromError(error) {
		return { hasError: true, error }
	}
	componentDidCatch(error, info) {
		// eslint-disable-next-line no-console
		console.error('App crashed', error, info)
	}
	render() {
		if (this.state.hasError) {
			return (
				<div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
					<h1>Something went wrong.</h1>
					<pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</pre>
				</div>
			)
		}
		return this.props.children
	}
}

const root = createRoot(document.getElementById('root'))
root.render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>
)
