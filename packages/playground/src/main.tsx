import './index.css';

// Browsers with Temporal of their own skip the polyfill, which then loads only where
// it is missing, and before anything that reads dates
if (typeof globalThis.Temporal === 'undefined') await import('temporal-polyfill/global');

const [{ StrictMode }, { createRoot }, { App }] = await Promise.all([
	import('react'),
	import('react-dom/client'),
	import('./app.tsx'),
]);

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
