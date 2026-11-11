import { render } from 'preact';
import { route } from './router';
import { useSignal } from './signal';
import './styles/base.css';
import { SvgDefs } from './components/Icons';
import { Toasts } from './components/misc';
import Kit from './pages/Kit';

const TITLES: Record<string, string> = {
  home: 'Home',
  inspect: 'Inspection Desk',
  draft: 'Draft a lease',
  lease: 'Lease',
  register: 'Register',
  hearing: 'Hearing',
  keyring: 'Keyring',
  office: 'Office',
  kit: 'Component kit',
  notfound: 'Room not found',
};

function App() {
  const r = useSignal(route);
  if (r.name === 'kit') return (<><SvgDefs /><Kit /><Toasts /></>);
  return (
    <main id="main">
      <h1>{TITLES[r.name]}</h1>
      <p>Stage 0 placeholder for route “{r.name}”.</p>
    </main>
  );
}

render(<App />, document.getElementById('app')!);
