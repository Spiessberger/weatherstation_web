import { render } from 'preact';
import { App } from './App';
import { I18nProvider } from './i18n';
import { UnitsProvider } from './units';
import 'uplot/dist/uPlot.min.css';
import './styles.css';

render(<I18nProvider><UnitsProvider><App /></UnitsProvider></I18nProvider>, document.getElementById('app')!);
