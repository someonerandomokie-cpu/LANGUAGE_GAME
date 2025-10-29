import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

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
