import { render } from 'preact';
import { App } from './App';
import { I18nProvider } from './i18n';
import 'uplot/dist/uPlot.min.css';
import './styles.css';

render(<I18nProvider><App /></I18nProvider>, document.getElementById('app')!);
